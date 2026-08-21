-- Seed the target publication database -- design doc section 3.
--
-- last_verified is set to 2026-08-16, the date the design doc compiled these
-- specs, NOT the date this migration runs. No one has independently checked
-- these against the outlets' live guidelines yet; the Phase 0 non-code task
-- "verify each primary pub's current submission page" is still open. Dating
-- these today would assert a verification that did not happen, and spec drift
-- is the highest-likelihood risk in the register (section 10).
--
-- Unknown stays NULL throughout. "We do not know this outlet's exclusivity
-- policy" and "this outlet does not require exclusivity" are different facts
-- and lead to different packaging decisions.

INSERT INTO publications (
  id, name, tier, method, submission_url, contact_email, spec_json,
  exclusivity_policy, counts_own_blog_as_published, typical_response_days,
  earned_or_paid, taste_notes, last_verified, active
) VALUES
(
  'pub-carats-and-cake', 'Carats & Cake', 'primary', 'portal', NULL, NULL,
  '{"size":"web","watermarks_allowed":false,"video_accepted":true,"video_notes":"A video folder boosts social consideration.","requirements":["web_size_images_only","no_watermarks","tag_all_vendors","upload_3_to_5_images_at_a_time","complete_the_form_in_one_session"],"notes":"No strict image count; more is better. Submissions that are not featured become profile Albums of up to 20 images, and all submissions feed the Cherry discovery product."}',
  'unknown', NULL, 56, 'earned',
  'Editorial weddings with strong vendor detail. Complete credits matter.',
  '2026-08-16', 1
),
(
  'pub-over-the-moon', 'Over The Moon', 'primary', 'web_form',
  'https://blog.overthemoon.com/submissions', NULL,
  '{"size":"web","requirements":["couple_love_story"],"notes":"Form and guidelines are published on the site."}',
  'unknown', NULL, NULL, 'earned',
  'Aspirational but authentic, fashion-forward. The couple''s love story is central.',
  '2026-08-16', 1
),
(
  'pub-the-anti-bride', 'The Anti-Bride', 'primary', 'web_form', NULL, NULL,
  '{"size":"web","requirements":[],"notes":"Accepts submissions worldwide."}',
  'unknown', NULL, NULL, 'earned',
  'Nontraditional, modern, fashion-focused.',
  '2026-08-16', 1
),
(
  'pub-the-lane', 'The Lane', 'primary', 'web_form', NULL, NULL,
  '{"size":"web","requirements":[],"notes":"Submissions accepted by web form or email."}',
  'unknown', NULL, NULL, 'earned',
  'Luxury international editorial aesthetic.',
  '2026-08-16', 1
),
(
  -- method is NULL rather than guessed: the design doc records this outlet's
  -- route as "Varies", and earned_or_paid is mixed because paid placement is
  -- in play. The UI surfaces the paid flag per opportunity.
  'pub-brides', 'Brides', 'primary', NULL, NULL, NULL,
  '{"size":"unknown","requirements":[],"notes":"Submission route varies by opportunity. Confirm earned versus paid placement before packaging."}',
  'unknown', NULL, NULL, 'mixed',
  'Large-audience outlet. Paid-placement dynamics apply; tag each opportunity as earned or paid.',
  '2026-08-16', 1
),
(
  'pub-wezoree', 'Wezoree', 'secondary', 'portal', NULL, NULL,
  '{"size":"web","requirements":[],"notes":"Destination-story friendly."}',
  'unknown', NULL, NULL, 'earned',
  'Destination weddings and travel-led stories.',
  '2026-08-16', 1
),
(
  'pub-wed-vibes', 'Wed Vibes', 'secondary', 'web_form', NULL, NULL,
  '{"size":"web","requirements":[],"notes":"Newer outlet."}',
  'unknown', NULL, NULL, 'earned',
  'Fashion-forward with destination energy.',
  '2026-08-16', 1
),
(
  'pub-loverly', 'Loverly', 'secondary', 'web_form',
  'https://loverly.com/tools/submit-wedding', NULL,
  '{"img_min":25,"img_max":40,"size":"web","video_accepted":true,"video_notes":"Video is accepted as a Vimeo or YouTube link.","requirements":["full_vendor_credits","event_description"],"notes":"A $59/mo Plus tier buys priority review. Not purchased for v1."}',
  'unknown', NULL, NULL, 'earned',
  'Editorial lens on details, fashion, and design. Full vendor credits are prioritised.',
  '2026-08-16', 1
);
