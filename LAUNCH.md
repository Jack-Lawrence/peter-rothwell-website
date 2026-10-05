# Launch checklist

Everything to sign up for, collect and check so all the site's features work. Work through it in order: some steps depend on earlier ones.

**Who:** 🧑‍💻 = Jack, 🏃 = Peter, 🤝 = together.

## 1. Gather from Peter 🏃

- [ ] **Photos:** a hero action shot (running on hills or trails, landscape, high resolution), a portrait for About, and a few training shots for blog covers. Phone photos are fine if they're sharp and well lit.
- [ ] **Plan details:** confirm what's included in each plan (`src/data/services.json`).
- [ ] **Policy answers:** the 11 highlighted gaps in `src/content/legal/` (preview them at `/privacy/`, `/terms/`, `/refunds/`, `/accessibility/`):
  - payment method and timing for monthly plans
  - PT cancellation notice period, and whether unused sessions carry over
  - message reply time for online clients
  - Run Club: move a place to the next block instead of a refund?
  - pausing or refunding plans for injured clients
  - professional liability insurer
  - how long he keeps client records
  - which training app he uses, if any
  - ICO registration number (see step 2)
- [ ] **Optional numbers:** longest run (hero badge), ultras finished, athletes coached, qualifications (About stats).
- [ ] **More testimonials**, with each client's permission to publish them.
- [ ] **Who controls the domain:** where rothwellsrunning.com is registered (Wix or another registrar), and the login. Nothing can go live without this.

## 2. Business admin 🏃

- [ ] **ICO data protection fee.** Peter holds clients' health information, so he very likely has to register and pay the yearly fee. Check at [ico.org.uk/fee](https://ico.org.uk/for-organisations/data-protection-fee/). Add the registration number to `src/content/legal/privacy.md`.
- [ ] **Insurance:** confirm his professional liability cover.
- [ ] Optional: a solicitor or his insurer's legal helpline reviews the four policies.

## 3. GitHub: code and preview site 🧑‍💻

- [ ] Create a GitHub repository and push the project.
- [ ] **Public or private:** GitHub Pages on a free plan needs a public repo. Private needs GitHub Pro.
- [ ] Settings → Pages → Source: **GitHub Actions**.
- [ ] Check the preview site loads at `https://<user>.github.io/<repo>/`.
- [ ] Before sharing the link widely, make preview builds `noindex` (AUDIT.md prompt 1), so Google doesn't index the preview.
- [ ] Send Peter the preview link.

## 4. Enquiry form: Web3Forms 🤝

- [ ] Go to [web3forms.com](https://web3forms.com) and enter **Peter's email** (Rothwell.pt@gmail.com). The access key is emailed to him, so he forwards it to Jack.
- [ ] Put the key in `src/data/site.json` → `enquiries.accessKey`, commit and push.
- [ ] Check the current free plan limits on their site.
- [ ] In the Web3Forms dashboard, restrict submissions to the site's domain if the option is available.
- [ ] **Test:** send an enquiry from the live preview. Check it arrives, that the subject reads "New enquiry: …", that Reply goes to the sender, and that it isn't in spam. If it is, Peter marks it "Not spam" and adds the sender to his contacts.
- [ ] Peter turns on Gmail notifications on his phone, so he sees enquiries quickly.

## 5. Instagram feed: Meta 🤝

Peter's account needs to be a **Business or Creator** account. Check in Instagram → Settings → Account type.

- [ ] 🧑‍💻 Create a Meta developer account at [developers.facebook.com](https://developers.facebook.com) and create an app with the **Instagram** product, using **API setup with Instagram login**.
- [ ] 🤝 Add @peter_rothwell.pt to the app (App roles → Instagram testers), and Peter accepts the invite in Instagram (Settings → Website permissions → Apps and websites). App review shouldn't be needed while the app only reads his own posts, but check Meta's current rules.
- [ ] 🤝 Generate a token for his account with `instagram_business_basic` permission.
- [ ] 🧑‍💻 Add it as the repo secret **`IG_ACCESS_TOKEN`** (Settings → Secrets and variables → Actions).
- [ ] 🧑‍💻 Create a fine-grained personal access token for this repo with **Secrets: read and write**, and add it as the secret **`GH_SECRETS_TOKEN`**. This lets the weekly workflow renew the Instagram token. Set a calendar reminder for this token's own expiry date.
- [ ] **Test:** run "Refresh Instagram token" and "Deploy to GitHub Pages" by hand (Actions tab → Run workflow). The six latest posts should appear on the home page.
- [ ] If the token ever expires (posts stop updating), generate a new one and replace `IG_ACCESS_TOKEN`.

## 6. Admin area (once built) 🤝

- [ ] Peter creates a free GitHub account, and Jack adds him as a collaborator on the repo.
- [ ] Walk Peter through `/admin`: write a test post, change a price, then undo both.
- [ ] Give him `docs/admin-guide.md`.

## 7. Cloudflare: going live 🧑‍💻

- [ ] Create a Cloudflare account and add `rothwellsrunning.com` (free plan).
- [ ] **Before changing anything,** note every existing DNS record at the current provider. Check for email (MX) records. Peter uses Gmail, so there's probably no domain email, but confirm.
- [ ] Change the domain's nameservers to Cloudflare's. If the domain is registered through Wix, either change the nameservers in Wix or transfer the domain out. The domain must stay active throughout.
- [ ] Create a **Cloudflare Pages** project connected to the GitHub repo: build command `npm run build`, output `dist`, Node 24.
- [ ] Add the environment variable `IG_ACCESS_TOKEN` (production).
- [ ] Add custom domains `www.rothwellsrunning.com` and `rothwellsrunning.com` (redirect the bare domain to www).
- [ ] Optional, recommended (AUDIT.md prompt 5):
  - **Turnstile** site key and secret, for server-side spam checks on the form
  - **Email Routing** with Peter's Gmail verified as a destination, to send enquiries without Web3Forms
  - **Web Analytics**, which is cookieless (add a line to the privacy policy)
  - a **Deploy Hook**, so Instagram updates can trigger a rebuild

## 8. Pre-launch checks 🧑‍💻

- [ ] All photos in place, with alt text.
- [ ] Replace all demo photos (src/assets/demo/) with Peter's own, and delete the folder. The hero, About portrait and blog covers import from it, so the build will point out anything missed.
- [ ] Sample blog posts removed or replaced.
- [ ] No yellow placeholders left on the policy pages (search the repo for `<mark>`).
- [ ] Prices and contact details match what Peter currently charges.
- [ ] Enquiry form: test message received.
- [ ] Instagram grid shows real posts.
- [ ] Old Wix addresses redirect: `/english-privacy-policy`, `/english-terms-conditions`, `/english-refund-policy`, `/accessibility-statement`.
- [ ] The `noindex` preview setting is off for the live build (remove `PREVIEW: 'true'` from the deploy workflow), and the canonical URLs use `https://www.rothwellsrunning.com`.
- [ ] Check on a real iPhone and Android phone, plus desktop Chrome, Safari and Firefox.
- [ ] Lighthouse on the live URL (mobile): all four scores 90+.

## 9. Launch day 🤝

- [ ] Switch the domain to Cloudflare Pages and wait for HTTPS to show as active.
- [ ] Visit the live site on mobile data (not Wi-Fi) to confirm the new site is showing.
- [ ] **Google Search Console:** add the domain (verify with a DNS TXT record in Cloudflare) and submit `https://www.rothwellsrunning.com/sitemap-index.xml` (once the sitemap is added, AUDIT.md prompt 1).
- [ ] **Google Business Profile** 🏃: check the website link and address (Meadowbank Shopping Park), and add photos. This matters a lot for "personal trainer Edinburgh" searches.
- [ ] Update the website link in the Instagram bio, if it isn't already rothwellsrunning.com.
- [ ] Keep the Wix site for a week in case anything needs checking, then cancel the Wix premium plan. Don't cancel any Wix domain subscription until the domain has been moved.

## 10. After launch

- [ ] **Monthly:** check the Web3Forms dashboard for spam getting through (if so, set `enquiries.captcha` to `true`) and how close he is to the free limit.
- [ ] **Monthly:** check the Instagram grid is still updating.
- [ ] **Before it expires:** renew the `GH_SECRETS_TOKEN` personal access token.
- [ ] **Yearly:** renew the ICO fee, check the policies are still accurate and update their "Last updated" dates, and renew the domain.

## Keys and accounts summary

| What | Where it's used | Owner | Expires |
| --- | --- | --- | --- |
| GitHub repo | Code, preview hosting, admin | Jack (Peter as collaborator) | No |
| Web3Forms access key | `src/data/site.json` | Peter's email | No |
| Meta developer app | Instagram API | Jack | No |
| `IG_ACCESS_TOKEN` | GitHub secret, Cloudflare env var | Peter's Instagram | 60 days, auto-refreshed weekly |
| `GH_SECRETS_TOKEN` | GitHub secret | Jack | When set (max 1 year) |
| Cloudflare account | DNS, hosting, optional Turnstile/Email Routing/Analytics | Jack or Peter | No |
| Domain registration | rothwellsrunning.com | Peter | Yearly |
| ICO registration | Privacy policy | Peter | Yearly |
