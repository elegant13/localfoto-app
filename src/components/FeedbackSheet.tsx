import React, { useState } from 'react';
import { MessageSquareHeart, Send, X, CheckCircle2 } from 'lucide-react';
import { FeedbackRating, submitFeedback } from '../services/analyticsService';

interface FeedbackSheetProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  profileId: string;
  onClose: () => void;
}

export const FeedbackSheet: React.FC<FeedbackSheetProps> = ({
  isOpen,
  title,
  subtitle,
  profileId,
  onClose,
}) => {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(
    null
  );
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (
    ratingToSend: FeedbackRating,
    noteToSend: string
  ) => {
    setSubmitting(true);
    await submitFeedback(ratingToSend, noteToSend, profileId);
    setSubmitting(false);
    setSubmitted(true);
    window.setTimeout(() => {
      setSubmitted(false);
      setSelectedRating(null);
      setComment('');
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customer Feedback"
    >
      <div
        className="w-full max-w-md bg-white rounded-[28px] p-5 m3-elevation-3 border border-[#E1E3E1] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#D3E3FD] text-[#0B57D0] flex items-center justify-center shrink-0">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#1F1F1F]">{title}</h3>
              <p className="text-xs text-[#444746]">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback"
            className="w-8 h-8 rounded-full bg-[#EDF2FA] text-[#444746] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-4 px-3 rounded-2xl bg-[#E6F4EA] text-[#137333] text-xs font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Thank you! Your feedback has been saved.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'great', label: 'Great' },
                  { id: 'okay', label: 'Okay' },
                  { id: 'needs_work', label: 'Needs Work' },
                ] as { id: FeedbackRating; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedRating(opt.id)}
                  className={`h-10 rounded-full text-xs font-bold border transition cursor-pointer ${
                    selectedRating === opt.id
                      ? 'bg-[#0B57D0] border-[#0B57D0] text-white'
                      : 'bg-[#F3F6FC] border-[#E1E3E1] text-[#1F1F1F]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {selectedRating && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit(selectedRating, comment);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  maxLength={300}
                  placeholder="Optional note (e.g. missing country, lighting)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="flex-1 h-10 px-3.5 rounded-full bg-[#F3F6FC] border border-[#C4C7C5] text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-4 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? '...' : 'Send'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
