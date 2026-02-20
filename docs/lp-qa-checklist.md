# LP QA Checklist

## Mobile CTA

- [ ] Sticky call bar appears below `1024px` viewport width
- [ ] Sticky button opens a valid `tel:` link
- [ ] Sticky click sends `sticky_call_click` to `dataLayer`

## Hero CTA

- [ ] Hero primary CTA opens `tel:` link
- [ ] Hero click sends `cta_call_click`
- [ ] Call number swaps when `utm_source=google` and campaign includes `repair`

## Form Completion

- [ ] Validation blocks empty/invalid fields
- [ ] Honeypot field blocks spam payloads
- [ ] Submit button disables while request is pending
- [ ] Success state appears on valid submit
- [ ] Error state shows structured message when webhook fails

## Events

- [ ] `form_start` fires only once per session on first field focus
- [ ] `form_submit_attempt` fires on submit click
- [ ] `form_success` fires on successful API response
- [ ] `form_error` includes error code label
- [ ] `faq_expand` includes question ID label

## Call Links

- [ ] Hero and sticky links both render with `tel:`
- [ ] Number is readable text (not image-only)
- [ ] Gas Safe number includes `aria-label="Gas Safe Registration Number"`
