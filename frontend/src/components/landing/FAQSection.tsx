import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'How are exchange rates calculated?',
    r: 'Rates are sourced from trusted global currency providers and updated in real-time. Our platform ensures you always see the latest market prices.',
  },
  {
    q: 'Is my financial data secure?',
    r: 'Absolutely. We use bank-level encryption and secure authentication to protect your account, conversion history, and personal information.',
  },
  {
    q: 'Can I track my conversion history?',
    r: 'Yes. Every conversion you make is logged with full details including rates, timestamps, and amounts. You can export your history anytime.',
  },
  {
    q: 'What features are available after signing up?',
    r: 'Registered users get access to conversion history, favorite currency pairs, real-time alerts, analytics dashboards, and portfolio tracking.',
  },
];

export function FAQSection() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="faq-section">
      <div className="section-header">
        <span className="eyebrow">Got Questions?</span>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about using AeroExchange.</p>
      </div>

      <div className="faq-list">
        {faqs.map((faq, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <article
              key={idx}
              className={`faq-item ${isExpanded ? 'faq-item--expanded' : ''}`}
            >
              <button
                type="button"
                className="faq-trigger"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                aria-expanded={isExpanded}
                aria-controls={`faq-answer-${idx}`}
              >
                <span>{faq.q}</span>
                <ChevronDown size={18} />
              </button>
              <div
                id={`faq-answer-${idx}`}
                className="faq-content"
                aria-hidden={!isExpanded}
              >
                <div className="faq-content-inner">
                  <p>{faq.r}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
