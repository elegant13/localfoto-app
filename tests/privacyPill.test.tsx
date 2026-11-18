// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';

describe('Private Pill & PrivacySheet interaction', () => {
  it('opens and closes the On-Device Privacy Guarantee modal when Private pill is clicked', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(App));
    });

    const pillBtn = container.querySelector(
      '[data-testid="private-pill-btn"]'
    ) as HTMLButtonElement | null;
    expect(pillBtn).not.toBeNull();
    expect(pillBtn?.textContent).toContain('Private');

    expect(
      container.querySelector('[aria-label="On-Device Privacy Guarantee"]')
    ).toBeNull();

    await act(async () => {
      pillBtn?.click();
    });

    const dialog = container.querySelector(
      '[aria-label="On-Device Privacy Guarantee"]'
    );
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('100% On-Device Privacy');
    expect(dialog?.textContent).toContain('Airplane Mode');

    const gotItBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.includes('Got It')
    );
    expect(gotItBtn).toBeDefined();

    await act(async () => {
      gotItBtn?.click();
    });

    expect(
      container.querySelector('[aria-label="On-Device Privacy Guarantee"]')
    ).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
