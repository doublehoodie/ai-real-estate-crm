export const FOLLOW_UP_TEMPLATES = {
  intro_call: (name: string) => `
Hi ${name || ""},

Thanks for reaching out! I'd love to learn more about what you're looking for and how I can help.

Would you be open to a quick call this week to go over your needs and preferences?

Best,
`.trim(),
  schedule_tour: (name: string) => `
Hi ${name || ""},

Based on what you're looking for, I'd be happy to set up a tour for a few properties that match your criteria.

Let me know a time that works for you, and I can coordinate everything.

Best,
`.trim(),
  send_listings: (name: string) => `
Hi ${name || ""},

I've found a few properties that align with your preferences and budget.

I can send them over for you to review - let me know if you'd like me to include options in specific neighborhoods or price ranges.

Best,
`.trim(),
  follow_up: (name: string) => `
Hi ${name || ""},

Just checking in - I wanted to see if you're still interested in exploring options.

Happy to help whenever you're ready!

Best,
`.trim(),
  reengage: (name: string) => `
Hi ${name || ""},

It's been a little while since we last connected, so I wanted to reach out and see if you're still considering a move.

If your plans have changed or you're ready to revisit your options, I'd be happy to help.

Best,
`.trim(),
} as const;

export type FollowUpTemplateKey = keyof typeof FOLLOW_UP_TEMPLATES;

export const FOLLOW_UP_TEMPLATE_BUTTONS: Array<{ key: FollowUpTemplateKey; label: string }> = [
  { key: "intro_call", label: "Intro Call" },
  { key: "schedule_tour", label: "Schedule Tour" },
  { key: "send_listings", label: "Send Listings" },
  { key: "follow_up", label: "Follow Up" },
  { key: "reengage", label: "Re-engage" },
];
