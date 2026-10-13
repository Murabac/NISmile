import React from 'react';

export type StatusVariant =
  | 'in-stock'
  | 'low-stock'
  | 'out-of-stock'
  | 'near-expiry'
  | 'expired'
  | 'confirmed'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no-show'
  | 'in-transit'
  | 'received'
  | 'draft'
  | 'promo'
  | 'delivered'
  | 'read'
  | 'replied';

interface StatusPillProps {
  variant: StatusVariant;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({
  variant,
  label,
  className = '',
  size = 'md',
}) => {
  // Configured colors matching DentaFlow brand specs:
  // Green #2E9E6B, Amber #E0A100, Red #D64545, Coral #FF6B57
  const configs: Record<
    StatusVariant,
    { text: string; bg: string; dot: string; defaultLabel: string }
  > = {
    'in-stock': {
      text: 'text-[#1E754E] dark:text-[#53D496]',
      bg: 'bg-[#2E9E6B]/10 dark:bg-[#2E9E6B]/20 border border-[#2E9E6B]/25',
      dot: 'bg-[#2E9E6B]',
      defaultLabel: 'In stock',
    },
    confirmed: {
      text: 'text-[#1E754E] dark:text-[#53D496]',
      bg: 'bg-[#2E9E6B]/10 dark:bg-[#2E9E6B]/20 border border-[#2E9E6B]/25',
      dot: 'bg-[#2E9E6B]',
      defaultLabel: 'Confirmed',
    },
    completed: {
      text: 'text-[#1E754E] dark:text-[#53D496]',
      bg: 'bg-[#2E9E6B]/10 dark:bg-[#2E9E6B]/20 border border-[#2E9E6B]/25',
      dot: 'bg-[#2E9E6B]',
      defaultLabel: 'Completed',
    },
    received: {
      text: 'text-[#1E754E] dark:text-[#53D496]',
      bg: 'bg-[#2E9E6B]/10 dark:bg-[#2E9E6B]/20 border border-[#2E9E6B]/25',
      dot: 'bg-[#2E9E6B]',
      defaultLabel: 'Received',
    },
    replied: {
      text: 'text-[#1E754E] dark:text-[#53D496]',
      bg: 'bg-[#2E9E6B]/10 dark:bg-[#2E9E6B]/20 border border-[#2E9E6B]/25',
      dot: 'bg-[#2E9E6B]',
      defaultLabel: 'Replied "Confirm"',
    },

    'low-stock': {
      text: 'text-[#A07300] dark:text-[#F3BA2F]',
      bg: 'bg-[#E0A100]/10 dark:bg-[#E0A100]/20 border border-[#E0A100]/25',
      dot: 'bg-[#E0A100]',
      defaultLabel: 'Low stock',
    },
    'near-expiry': {
      text: 'text-[#A07300] dark:text-[#F3BA2F]',
      bg: 'bg-[#E0A100]/10 dark:bg-[#E0A100]/20 border border-[#E0A100]/25',
      dot: 'bg-[#E0A100]',
      defaultLabel: 'Near expiry',
    },
    scheduled: {
      text: 'text-[#0C3B4A] dark:text-[#2CC7BF]',
      bg: 'bg-[#12A6A0]/10 dark:bg-[#12A6A0]/20 border border-[#12A6A0]/25',
      dot: 'bg-[#12A6A0]',
      defaultLabel: 'Scheduled',
    },
    'in-transit': {
      text: 'text-[#0C3B4A] dark:text-[#2CC7BF]',
      bg: 'bg-[#12A6A0]/10 dark:bg-[#12A6A0]/20 border border-[#12A6A0]/25',
      dot: 'bg-[#12A6A0]',
      defaultLabel: 'In transit',
    },
    delivered: {
      text: 'text-[#0C3B4A] dark:text-[#2CC7BF]',
      bg: 'bg-[#12A6A0]/10 dark:bg-[#12A6A0]/20 border border-[#12A6A0]/25',
      dot: 'bg-[#12A6A0]',
      defaultLabel: 'Delivered',
    },
    read: {
      text: 'text-[#0C3B4A] dark:text-[#2CC7BF]',
      bg: 'bg-[#12A6A0]/10 dark:bg-[#12A6A0]/20 border border-[#12A6A0]/25',
      dot: 'bg-[#12A6A0]',
      defaultLabel: 'Read',
    },
    draft: {
      text: 'text-[#617D84] dark:text-[#8EAEB5]',
      bg: 'bg-[#617D84]/10 dark:bg-[#617D84]/20 border border-[#617D84]/25',
      dot: 'bg-[#617D84]',
      defaultLabel: 'Draft',
    },

    'out-of-stock': {
      text: 'text-[#B82E2E] dark:text-[#FF7070]',
      bg: 'bg-[#D64545]/10 dark:bg-[#D64545]/20 border border-[#D64545]/25',
      dot: 'bg-[#D64545]',
      defaultLabel: 'Out of stock',
    },
    expired: {
      text: 'text-[#B82E2E] dark:text-[#FF7070]',
      bg: 'bg-[#D64545]/10 dark:bg-[#D64545]/20 border border-[#D64545]/25',
      dot: 'bg-[#D64545]',
      defaultLabel: 'Expired',
    },
    cancelled: {
      text: 'text-[#B82E2E] dark:text-[#FF7070]',
      bg: 'bg-[#D64545]/10 dark:bg-[#D64545]/20 border border-[#D64545]/25',
      dot: 'bg-[#D64545]',
      defaultLabel: 'Cancelled',
    },
    'no-show': {
      text: 'text-[#B82E2E] dark:text-[#FF7070]',
      bg: 'bg-[#D64545]/10 dark:bg-[#D64545]/20 border border-[#D64545]/25',
      dot: 'bg-[#D64545]',
      defaultLabel: 'No-show',
    },

    promo: {
      text: 'text-[#C93824] dark:text-[#FF9D8E]',
      bg: 'bg-[#FF6B57]/15 dark:bg-[#FF7A66]/20 border border-[#FF6B57]/35',
      dot: 'bg-[#FF6B57]',
      defaultLabel: 'Promotion',
    },
  };

  const current = configs[variant] || configs.draft;
  const displayText = label || current.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap select-none ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${current.bg} ${current.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot} shrink-0`} aria-hidden="true" />
      <span>{displayText}</span>
    </span>
  );
};
