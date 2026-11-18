/// <reference types="@cloudflare/workers-types" />

export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
}

interface CfProperties {
  postalCode?: string;
  city?: string;
  region?: string;
  country?: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function extractCoarseGeo(request: Request, explicitZip?: string): {
  zipCode: string;
  city: string;
  region: string;
  country: string;
} {
  const cf = (request as Request & { cf?: CfProperties }).cf ?? {};
  const zip = (explicitZip || cf.postalCode || 'Unknown').slice(0, 16).trim();
  const city = (cf.city || 'Unknown').slice(0, 64).trim();
  const region = (cf.region || '').slice(0, 64).trim();
  const country = (cf.country || 'US').slice(0, 8).trim();
  return { zipCode: zip || 'Unknown', city, region, country };
}

let feedbackGeoChecked = false;

async function ensureFeedbackGeoColumns(db: D1Database): Promise<void> {
  if (feedbackGeoChecked) return;
  try {
    const info = await db
      .prepare('PRAGMA table_info(feedback)')
      .all<{ name: string }>();
    const cols = new Set((info.results ?? []).map((c) => c.name));
    if (!cols.has('region')) {
      await db.prepare('ALTER TABLE feedback ADD COLUMN region TEXT').run();
    }
    if (!cols.has('country')) {
      await db.prepare('ALTER TABLE feedback ADD COLUMN country TEXT').run();
    }
    feedbackGeoChecked = true;
  } catch {
    // Do not block requests if schema migration check fails
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Track anonymous usage event (visit | photo_generated | store_search)
    if (url.pathname === '/api/event' && request.method === 'POST') {
      if (!env.DB) {
        return jsonResponse({ ok: true, stored: false });
      }
      try {
        const body = (await request.json()) as {
          eventType?: string;
          profileId?: string;
          zipCode?: string;
        };
        const allowedEvents = new Set([
          'visit',
          'photo_generated',
          'store_search',
        ]);
        const eventType =
          body.eventType && allowedEvents.has(body.eventType)
            ? body.eventType
            : 'visit';
        const profileId = (body.profileId || 'us_passport').slice(0, 32);
        const geo = extractCoarseGeo(request, body.zipCode);

        await env.DB.prepare(
          `INSERT INTO events (event_type, profile_id, zip_code, city, region, country)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        )
          .bind(
            eventType,
            profileId,
            geo.zipCode,
            geo.city,
            geo.region,
            geo.country
          )
          .run();

        return jsonResponse({ ok: true, stored: true });
      } catch {
        return jsonResponse({ ok: false }, 400);
      }
    }

    // 2. Submit Customer feedback (rating + optional comment)
    if (url.pathname === '/api/feedback' && request.method === 'POST') {
      if (!env.DB) {
        return jsonResponse({ ok: true, stored: false });
      }
      try {
        const body = (await request.json()) as {
          rating?: string;
          comment?: string;
          profileId?: string;
        };
        const allowedRatings = new Set(['great', 'okay', 'needs_work']);
        const rating =
          body.rating && allowedRatings.has(body.rating)
            ? body.rating
            : 'great';
        const comment = (body.comment || '').slice(0, 500).trim();
        const profileId = (body.profileId || 'us_passport').slice(0, 32);
        const geo = extractCoarseGeo(request);

        await ensureFeedbackGeoColumns(env.DB);

        await env.DB.prepare(
          `INSERT INTO feedback (rating, comment, profile_id, zip_code, city, region, country)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
          .bind(
            rating,
            comment,
            profileId,
            geo.zipCode,
            geo.city,
            geo.region,
            geo.country
          )
          .run();

        return jsonResponse({ ok: true, stored: true });
      } catch {
        return jsonResponse({ ok: false }, 400);
      }
    }

    // 3. Public visitor & photo counter
    if (url.pathname === '/api/stats/public' && request.method === 'GET') {
      if (!env.DB) {
        return jsonResponse({ totalVisitors: 0, totalPhotos: 0 });
      }
      try {
        const row = await env.DB.prepare(
          `SELECT
             SUM(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS totalVisitors,
             SUM(CASE WHEN event_type = 'photo_generated' THEN 1 ELSE 0 END) AS totalPhotos
           FROM events`
        ).first<{ totalVisitors: number | null; totalPhotos: number | null }>();

        return jsonResponse({
          totalVisitors: Number(row?.totalVisitors ?? 0),
          totalPhotos: Number(row?.totalPhotos ?? 0),
        });
      } catch {
        return jsonResponse({ totalVisitors: 0, totalPhotos: 0 });
      }
    }

    // 4. Private Admin Dashboard metrics (protected by ADMIN_PASSWORD Worker Secret)
    if (url.pathname === '/api/stats/admin' && request.method === 'GET') {
      const expected = env.ADMIN_PASSWORD?.trim();
      if (!expected) {
        return jsonResponse(
          { error: 'ADMIN_PASSWORD secret is not configured in Cloudflare.' },
          503
        );
      }

      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

      if (!token || token !== expected) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      if (!env.DB) {
        return jsonResponse(
          { error: 'D1 database binding (DB) is not configured yet.' },
          503
        );
      }

      try {
        await ensureFeedbackGeoColumns(env.DB);

        const totals = await env.DB.prepare(
          `SELECT
             SUM(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS totalVisitors,
             SUM(CASE WHEN event_type = 'photo_generated' THEN 1 ELSE 0 END) AS totalPhotos,
             SUM(CASE WHEN event_type = 'photo_generated' AND (zip_code = '20105' OR LOWER(COALESCE(city, '')) LIKE '%arcola%' OR LOWER(COALESCE(region, '')) LIKE '%arcola%') THEN 1 ELSE 0 END) AS ownerPhotos
           FROM events`
        ).first<{
          totalVisitors: number | null;
          totalPhotos: number | null;
          ownerPhotos: number | null;
        }>();

        const byProfileRes = await env.DB.prepare(
          `SELECT profile_id, COUNT(*) AS count
           FROM events
           WHERE event_type = 'photo_generated'
           GROUP BY profile_id
           ORDER BY count DESC`
        ).all<{ profile_id: string; count: number }>();

        const byZipRes = await env.DB.prepare(
          `SELECT
             zip_code,
             MAX(city) AS city,
             MAX(region) AS region,
             MAX(country) AS country,
             SUM(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS visits,
             SUM(CASE WHEN event_type = 'photo_generated' THEN 1 ELSE 0 END) AS photos
           FROM events
           GROUP BY zip_code
           ORDER BY (visits + photos) DESC
           LIMIT 50`
        ).all<{
          zip_code: string;
          city: string;
          region: string;
          country: string;
          visits: number;
          photos: number;
        }>();

        const feedbackRes = await env.DB.prepare(
          `SELECT id, rating, comment, profile_id, zip_code, city, region, country, created_at
           FROM feedback
           ORDER BY id DESC
           LIMIT 50`
        ).all<{
          id: number;
          rating: string;
          comment: string;
          profile_id: string;
          zip_code: string;
          city: string;
          region: string | null;
          country: string | null;
          created_at: string;
        }>();

        const totalPhotos = Number(totals?.totalPhotos ?? 0);
        const ownerPhotos = Number(totals?.ownerPhotos ?? 0);
        const externalPhotos = Math.max(0, totalPhotos - ownerPhotos);

        return jsonResponse({
          totalVisitors: Number(totals?.totalVisitors ?? 0),
          totalPhotos,
          ownerPhotos,
          externalPhotos,
          byProfile: byProfileRes.results ?? [],
          byZip: byZipRes.results ?? [],
          recentFeedback: feedbackRes.results ?? [],
        });
      } catch {
        return jsonResponse({ error: 'Database query failed' }, 500);
      }
    }

    // 5. All other requests -> serve static Vite SPA assets
    return env.ASSETS.fetch(request);
  },
};
