# SEO and AI search plan

Recovered from the November 19, 2026 discussion. First pass committed as 33026f5 on November 20. Follow-up subject pages remain local until reviewed.

## Current work

- Prepared: descriptive homepage, tutor-directory, and tutor-profile titles and descriptions. Branding remains in the visible homepage copy.
- Already implemented: the planner's initial package screen is server-rendered from the same Gleam model and view. Prices, student limits, session length, and weekly scheduling explanations are readable before JavaScript loads. Keep one package chooser; no planner redesign.
- Prepared: Organization and tutoring Service structured data, plus tutor ProfilePage/Person and page breadcrumbs. Only describe visible, verified content. No fabricated review ratings or business addresses.
- Prepared: dynamic `/sitemap.xml` containing the homepage, directory, and active tutor profile slugs. Excludes admin, APIs, previews, checkout, and archived profiles. Canonicals use `https://www.mychristiantutors.com`.
- Preserved: `noindex, nofollow, noarchive` in HTML and Vercel headers. Robots.txt allows crawling so crawlers can read the noindex rule. No indexing launch has been authorized.

## Next content work

1. Local subject pages now cover Algebra, Biology, and Writing & English, with a subject directory, practical session information, questions, current tutors, and links into planning. Subject names follow catalog renames via catalog_name. These are editorial landing pages, not new categories in the booking model. Review the copy before publishing.
2. Ask tutors to confirm their teaching approaches and the problems they help students solve. Keep MyFunScience classroom experience distinct from this tutoring service. Do not invent credentials or tutor-specific claims.
3. Replace the two temporary testimonials with real statements before indexing. Confirm tutor profiles, pricing, the free-session offer terms, cancellation/rescheduling policies, and contact information. Keep the relationship with MyFunScience clear.

## At public launch

1. Make an explicit indexing decision. Update both the HTML robots meta tag and Vercel response header together, retaining noindex for admin, checkout, previews, and other private pages.
2. Check the www domain, HTTPS, canonicals, and any alternate-domain handling. Verify the sitemap against the live catalog.
3. Register the domain with Google Search Console and Bing Webmaster Tools and submit the sitemap. Add its URL to robots.txt.
4. Decide crawler access for AI search. OAI-SearchBot and model-training crawler GPTBot are separate choices; no permission change has been made yet.
5. Monitor indexing and search results after launch. Structured data and readable text support understanding; they do not guarantee rich results or AI citations.

## Verification

Local checks confirm the homepage/directory/profile metadata, parseable JSON-LD, package prices in the initial HTML, and public-only sitemap URLs. The first pass contained 16 URLs; the subject directory and 3 subject pages bring it to 20. Both prelaunch indexing protections remain intact. Further subject/content work requires editorial review.

## Search Console setup now

Open [Google Search Console](https://search.google.com/search-console/welcome) using the Google account that should own the property. Choose Domain and enter `mychristiantutors.com` without a protocol, path, or www. This covers the domain's protocol and subdomain variations. Give Shawn the DNS verification record Google supplies; preserve existing DNS records. Complete verification after the record is visible. Keep that record afterward.

Ownership verification does not require removing the site's noindex protection. Wait to submit `/sitemap.xml` and request indexing until the launch decision. Google supplies the real verification token; none has been invented or added to the application.

## Guidance

- [Google AI search guidance](https://developers.google.com/search/docs/appearance/ai-features): normal SEO fundamentals apply; no special AI markup is required.
- [Google Search Essentials](https://developers.google.com/search/docs/essentials).
- [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization).
- [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing): a crawler must be able to access a page to read its noindex instruction.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots).
