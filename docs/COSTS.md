# Ume costs, pricing and money routing

_17 September 2026. All prices are USD and were checked against vendor pages on this date (links inline). Anything marked **unverified** relies on a third-party source, a forum post or my own assumption. Do not treat it as fact until you have checked it. Nothing here is tax, legal or investment advice. Take section 7 to an accountant._

## 1. Unit prices

| Vendor            | Item                         | Price                                                                                                                                                                                                                                          | Source                                                                                                     |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Railway**       | Hobby                        | $5/mo, includes $5 of usage                                                                                                                                                                                                                    | [railway.com/pricing](https://railway.com/pricing)                                                         |
|                   | Pro                          | $20/mo per workspace, includes $20 of usage                                                                                                                                                                                                    | same                                                                                                       |
|                   | Memory                       | $0.00000386/GB-s, about **$10 per GB-month**                                                                                                                                                                                                   | same                                                                                                       |
|                   | CPU                          | $0.00000772/vCPU-s, about **$20 per vCPU-month**                                                                                                                                                                                               | same                                                                                                       |
|                   | Egress                       | **$0.05/GB**                                                                                                                                                                                                                                   | same; [docs](https://docs.railway.com/reference/pricing/plans)                                             |
|                   | Volume                       | about $0.15/GB-month                                                                                                                                                                                                                           | same                                                                                                       |
|                   | Commercial use on Hobby      | Railway staff said "if you are running a for-profit, commercial, etc service on railway, thats a pro workload" (2024-03-21). The current plan docs do not mention it. **Treat Pro as required. The wording in the current ToS is unverified.** | [station.railway.com](https://station.railway.com/questions/commercial-usage-using-hobby-plan-7fd8cf69)    |
| **Neon**          | Free                         | 100 CU-hours/project/month; 0.5 GB; scale-to-zero after 5 min (fixed). When you use up the hours, "compute is suspended until the next billing period"                                                                                         | [neon.com/pricing](https://neon.com/pricing), [plans](https://neon.com/docs/introduction/plans)            |
|                   | Launch                       | No monthly minimum; **$0.106/CU-hour**; storage **$0.35/GB-month**; history $0.20/GB-month; scale-to-zero can be disabled                                                                                                                      | same                                                                                                       |
|                   | Scale                        | $0.222/CU-hour                                                                                                                                                                                                                                 | same                                                                                                       |
|                   | Compute size                 | 1 CU ≈ 4 GB RAM; smallest 0.25 CU                                                                                                                                                                                                              | same                                                                                                       |
| **Cloudflare R2** | Storage                      | **$0.015/GB-month**                                                                                                                                                                                                                            | [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/)                      |
|                   | Class A (write/list)         | $4.50 per million                                                                                                                                                                                                                              | same                                                                                                       |
|                   | Class B (read)               | $0.36 per million                                                                                                                                                                                                                              | same                                                                                                       |
|                   | Egress                       | Free                                                                                                                                                                                                                                           | same                                                                                                       |
|                   | Free tier                    | 10 GB-month, 1M Class A, 10M Class B per month                                                                                                                                                                                                 | same                                                                                                       |
| **Vercel**        | Hobby                        | $0. "Hobby teams are restricted to non-commercial personal use only". Taking payments counts as commercial use                                                                                                                                 | [fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)                                  |
|                   | Pro                          | **$20/mo per developer seat**, includes $20 of usage; viewer seats unlimited                                                                                                                                                                   | [vercel.com/pricing](https://vercel.com/pricing)                                                           |
| **Resend**        | Free                         | 3,000 emails/mo, 100/day, 3 domains                                                                                                                                                                                                            | [resend.com/pricing](https://resend.com/pricing)                                                           |
|                   | Pro                          | $20/mo for 50k emails; overage $0.90 per 1,000                                                                                                                                                                                                 | same                                                                                                       |
| **Stripe (US)**   | Cards                        | **2.9% + 30¢** domestic; +1.5% for international cards; +1% when currency is converted                                                                                                                                                         | [stripe.com/pricing](https://stripe.com/pricing)                                                           |
|                   | Billing (subscriptions)      | **0.7%** of Billing volume (pay as you go)                                                                                                                                                                                                     | same; [billing pricing](https://stripe.com/billing/pricing)                                                |
|                   | Customer Portal              | Included with paid Billing, no separate fee                                                                                                                                                                                                    | [support.stripe.com](https://support.stripe.com/questions/billing-customer-portal)                         |
|                   | Tax Basic                    | 0.5% per transaction where you are registered                                                                                                                                                                                                  | [stripe.com/pricing](https://stripe.com/pricing)                                                           |
|                   | Disputes                     | $15 per dispute received, plus $15 if you respond manually                                                                                                                                                                                     | same                                                                                                       |
| **Discord**       | Bot API, gateway, voice      | No fee. **Not checked against a price page**                                                                                                                                                                                                   | —                                                                                                          |
| **Domain**        | .com at Cloudflare Registrar | $10.44/yr, rising to $11.15/yr on 1 Nov 2026 (about $0.90/mo)                                                                                                                                                                                  | [third-party summary](https://startupowl.com/reviews/cloudflare-registrar) (**not checked on Cloudflare**) |
| **DMCA agent**    | copyright.gov                | $6 per 3 years (about $0.17/mo)                                                                                                                                                                                                                | docs/PLAN_REVIEW.md                                                                                        |

Alternative bot hosts:

| Host                     | Plan                                        | Price                            | Included traffic / egress                                         | Source                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hetzner EU (FSN/NBG/HEL) | CX23 / CX33 (4 vCPU, 8 GB) / CAX11          | $6.49 / **$9.99** / $6.99        | 20 TB/server (**unverified, third-party**)                        | [price adjustment 15 Jun 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [bitdoze](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/) |
| Hetzner US (Ashburn)     | CPX11 (2 vCPU, 2 GB) / CPX21 (3 vCPU, 4 GB) | **$20.49** / $37.49              | 1 TB / 2 TB; overage about €1/TB (**unverified**)                 | [price adjustment](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [CPX specs](https://www.hetzner.com/cloud/regular-performance/)                    |
| DigitalOcean             | Basic $6 / $12 / $24                        | 1 GiB / 2 GiB / 4 GiB + 2 vCPU   | 1,000 / 2,000 / 4,000 GiB, pooled per team; overage **$0.01/GiB** | [droplet pricing](https://www.digitalocean.com/pricing/droplets), [bandwidth](https://docs.digitalocean.com/platform/billing/bandwidth/)                                                   |
| Fly.io                   | shared-cpu-1x 1 GB / performance-1x 4 GB    | $5.92 / $42.58                   | **$0.02/GB** egress (North America); IPv4 $2/mo                   | [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/)                                                                                                                            |
| Home PC                  | Electricity                                 | US average 18.34¢/kWh (Sep 2026) | Your ISP upload speed and data cap                                | [electricchoice.com](https://www.electricchoice.com/electricity-prices-by-state/) (**third-party summary of EIA data**)                                                                    |

## 2. Voice egress

- Opus payload at 128 kbps is 16.0 KB/s. Discord sends 50 packets/s (20 ms frames).
- Assumed overhead per packet is about 70 bytes: IPv4 20 + UDP 8 + RTP 12 + transport AEAD tag and nonce about 20 + DAVE end-to-end encryption trailer about 10. That adds 3.5 KB/s, **about 22%** (**my estimate, not measured**).
- **19.5 KB/s = 156 kbps, which is about 70 MB (0.070 GB) per listening hour.**

| Playing time    | GB/month | Railway ($0.05) | Fly ($0.02) | DO overage ($0.01/GiB) | Inside a VPS allowance |
| --------------- | -------- | --------------- | ----------- | ---------------------- | ---------------------- |
| 1 hour          | 0.07     | $0.0035         | $0.0014     | $0.0007                | $0                     |
| 6 h/day (180 h) | **12.6** | **$0.63**       | $0.25       | $0.12                  | $0                     |
| 24/7 (730 h)    | **51.3** | **$2.56**       | $1.03       | $0.48                  | $0                     |

The bot downloads audio from R2 as inbound traffic, which is free on every host here. Auto-pause stops sending packets, so egress is only paid while humans are in the channel.

## 3. Is Railway too expensive? Scale model

**Assumptions** (all **unverified**, so load-test before relying on them):

- Every claimed server holds a voice connection 24/7, and each connection adds 8 MB RAM on top of the measured 83 MB base.
- Each stream plays 6 h/day and uses 0.004 vCPU while playing, so one core carries about 250 streams. Ume passes Opus through without ffmpeg. The widely quoted "150–300 MB per connection" ([renzom](https://www.renzom.com/blog/discord-bot-ram-sizing-2026)) is for bots that transcode with FFmpeg and does not apply here.
- Peak concurrency is 50% of servers.

**Node caveat:** @discordjs/voice sends every stream's packets from one JS thread, so a single process tops out at about one core. Plan for about one bot process (shard) per 200 concurrent streams, well before the 2,500-guild sharding requirement.

| Claimed servers        | Peak streams | Bot RAM | Egress/mo | Railway bot usage (RAM + CPU + egress) | Railway bill (Pro, + worker about $1.50) |
| ---------------------- | ------------ | ------- | --------- | -------------------------------------- | ---------------------------------------- |
| 1                      | 1            | 0.09 GB | 12.6 GB   | $1.66                                  | **$20** (covered by credit)              |
| 10                     | 5            | 0.16 GB | 126 GB    | $8.23                                  | **$20**                                  |
| 100                    | 50           | 0.88 GB | 1,260 GB  | $73.93                                 | **about $76**                            |
| 1,000                  | 500          | 8.1 GB  | 12,600 GB | $730.93                                | **about $735**                           |
| 1,000, 24/7 worst case | 1,000        | 8.1 GB  | 51,300 GB | $2,666                                 | about $2,670                             |

On Railway, egress is 85% of the bot cost at 100 servers.

Bot hosting at 100 and 1,000 servers (6 h/day):

| Option                 | 100 servers                                                        | 1,000 servers                                                                   | Notes                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway                | about $76                                                          | about $735                                                                      | Zero ops; $0.05/GB egress is the problem                                                                                                                                                                                      |
| Fly.io                 | about $31 (shared-cpu-1x 1 GB + $25 egress); $57 on performance-1x | about $337 (2× performance-1x 4 GB + $252 egress)                               | Shared-CPU throttling risk not checked                                                                                                                                                                                        |
| DigitalOcean (US East) | **$12** (1× $12 droplet, 2,000 GiB)                                | **about $72** (3× $24: 12 GiB RAM, 6 vCPU, 12,000 GiB pooled ≥ 11,735 GiB used) | Low ops; pooled transfer                                                                                                                                                                                                      |
| Hetzner US (Ashburn)   | about $21 (CPX11 + 0.26 TB overage)                                | about $120 (3× CPX21 + 6.6 TB overage)                                          | US allowances are small                                                                                                                                                                                                       |
| Hetzner EU             | **$9.99** (CX33)                                                   | **about $20** (2× CX33, 20 TB each)                                             | Cheapest; about 90 ms to US voice servers, so test for audio jitter                                                                                                                                                           |
| Home PC                | about $8 electricity (60 W × 730 h, assumed)                       | Not viable                                                                      | 100 servers: 7.8 Mbps peak upload and 1.26 TB/mo, which may break ISP data caps and terms. 1,000 servers: 78 Mbps upload and 12.6 TB/mo. No redundancy through power or ISP outages. Fine for the extractor, not for the bot. |

**Answer:** Railway is not expensive at 1–25 servers, because the Pro $20 credit absorbs everything. Past that, it costs about **$0.72 per claimed server per month** (mostly egress). A VPS costs about $0.01–0.10 per server.

**Break points:**

1. **Up to about 25 active servers:** stay on Railway Pro.
2. **About 40–50 active servers** (Railway bill passes about $35), **or before promoting the free tier publicly, whichever comes first:** move the bot to a DigitalOcean $12 US droplet (carries about 150 servers at 6 h/day), or to a Hetzner EU CX33 if a jitter test passes. Keep the worker on Railway, because per-second billing suits bursty transcodes.
3. **About 150 servers:** add a second process or droplet. Shard by guild so that no process exceeds about 200 concurrent streams.
4. **About 1,000 servers:** 3–4 VPS nodes (about $72–120/mo). Railway would cost about $735.

## 4. Fixed baseline with about 0 users

**pg-boss keeps Neon awake.** Neon suspends only after "no active queries for 5 minutes" ([compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle)). pg-boss workers poll every 2 s by default ([pg-boss docs](https://github.com/timgit/pg-boss/blob/master/docs/api/workers.md)), and supervise/monitor run every 60 s. Both the worker and the bot run pg-boss with default settings (`apps/worker/src/index.ts`, `apps/bot/src/lib/queue.ts`). So the compute never suspends, and 0.25 CU × 730 h = **182.5 CU-h/month**. (That polling prevents suspension is inferred from Neon's definition; Neon does not state it directly.)

- **On Neon Free:** the 100 CU-h run out after about 400 h, around **day 17 of each month**, and the database is then suspended until the next cycle. **This is an outage risk right now.**
- **On Launch:** 182.5 × $0.106 = **$19.35** plus storage.

| Line                | Today (Hobby tiers; not allowed for commercial use) | A: current vendors, compliant                      | B: lean, compliant (Postgres on Railway)                                                      |
| ------------------- | --------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Vercel              | $0                                                  | $20 (Pro, 1 seat)                                  | $20                                                                                           |
| Railway             | $5 (Hobby)                                          | $20 (Pro; bot + worker about $2.50, inside credit) | $20 (bot + worker + Postgres about $5–6, inside credit; **Postgres RAM estimate unverified**) |
| Neon                | $0 (breaks around day 17)                           | about $19.60 (Launch, always on, 0.5 GB)           | $0                                                                                            |
| R2                  | $0 (free tier)                                      | $0                                                 | $0                                                                                            |
| Resend              | $0                                                  | $0                                                 | $0                                                                                            |
| Domain + DMCA agent | $1.07                                               | $1.07                                              | $1.07                                                                                         |
| Stripe              | $0 until sales                                      | $0                                                 | $0                                                                                            |
| **Total**           | **about $6**                                        | **about $61/mo**                                   | **about $41/mo**                                                                              |

An even leaner option is bot, worker and Postgres on one $12 droplet plus Vercel Pro, about $33/mo. That means you run your own backups and restarts.

## 5. Marginal cost per server

**Components:**

- **Storage:** plan quota × $0.015.
- **R2 operations:** about $0.01–0.20/mo (4 Class A per upload, 1 Class B per play).
- **Voice:** egress, 8 MB RAM ($0.08) and CPU ($0.02 at 6 h/day, $0.08 at 24/7).
- **Transcode:** 5 vCPU-s per track assumed, about $0.00004/track. Filling Studio once costs about $2.50.
- **Scenarios:** "Typical" means 50% of quota and 6 h/day. "Worst" means full quota and 24/7.

| Tier (price)        | Storage full / 50% | Railway typical | Railway worst | VPS typical | Stripe fee (3.6% + 30¢) |
| ------------------- | ------------------ | --------------- | ------------- | ----------- | ----------------------- |
| Free 1 GB           | $0.015 / $0.008    | **$0.74**       | $2.73         | $0.06       | —                       |
| Plus 10 GB ($4)     | $0.15 / $0.075     | $0.83           | $2.91         | $0.15       | $0.44 (11.1%)           |
| Pro 50 GB ($12)     | $0.75 / $0.375     | $1.18           | $3.62         | $0.50       | $0.73 (6.1%)            |
| Studio 250 GB ($35) | $3.75 / $1.875     | $2.91           | $7.17         | $2.23       | $1.56 (4.5%)            |

Add +0.5% if Stripe Tax is used and +1.5% for non-US cards. Each chargeback costs $15, so one chargeback wipes out several months of Plus margin.

## 6. Pricing recommendation

"Contribution" below means price − Stripe fee − marginal cost − **15% reserve** (for refunds, chargebacks and infra buffer).

| Tier   | Current     | **Recommended monthly** | **Annual (2 months free)** | Contribution, Railway typical | Railway worst        | VPS typical |
| ------ | ----------- | ----------------------- | -------------------------- | ----------------------------- | -------------------- | ----------- |
| Free   | $0, 1 GB    | $0, 1 GB (keep)         | —                          | −$0.74                        | −$2.73               | −$0.06      |
| Plus   | $4, 10 GB   | **$5**                  | **$50**                    | $2.94 (at $4: $2.13)          | $0.86 (at $4: $0.05) | $3.62       |
| Pro    | $12, 50 GB  | **$12** (keep)          | **$120**                   | $8.29                         | $5.85                | $8.97       |
| Studio | $35, 250 GB | **$35** (keep)          | **$350**                   | $25.28                        | $21.02               | $25.96      |

- **Why Plus should be $5:** at $4 on Railway, a heavy Plus server nets about 5¢. Stripe's 30¢ stays under 10% of the charge only when the price is at least 0.30 / (0.10 − 0.036) = **$4.69**, so **$5 is the lowest sensible monthly price**.
- **Annual plans:** a $50 charge pays $2.10 in fees (4.2%), against $5.76 (9.6%) over 12 monthly charges. Push annual billing.
- **Break-even:** assume a paid mix of 70% Plus, 25% Pro and 5% Studio. Weighted contribution is then **$5.39/paid server** (Railway typical).
  - Baseline A ($61): **12 paid servers**.
  - Baseline B ($41): **8 paid servers**.
- **How much free usage paid servers can carry:** on Railway, each paid server covers about **7 free servers** ($5.39 / $0.74) before baseline. Free-to-paid ratios of 20:1 or more are normal, so **the free tier loses money on Railway**. On a VPS, each paid server covers about 90 free servers.
- **Caps on free cost, in order of impact:**
  1. Move the bot to a VPS. This drops free cost from $0.74 to about $0.06.
  2. Keep auto-pause (already in place) and the 60-day idle purge.
  3. Optional, founder decision: free workspaces leave voice after 24 h with no listeners and rejoin when someone joins. This contradicts "Bot stays connected" in PLAN_REVIEW.md, so change that document first.
  4. Optional: a monthly listening-hours cap for Free (e.g. 150 h).
  5. Leave 1 GB of free storage as it is; it costs 1.5¢.

## 7. Routing money to "the set places"

**What Stripe can and cannot do**

- **One payout account:** Stripe allows "only one bank account for payouts per currency" ([support](https://support.stripe.com/questions/can-i-add-more-than-one-bank-account-for-payouts)). You cannot split USD payouts by percentage. "Automatic payout splitting" only breaks a large payout into several transfers to the same bank because of rail limits ([support](https://support.stripe.com/questions/automatic-payout-splitting)).
- **Stripe Connect does not fit:** it pays **connected accounts**, meaning sellers or service providers on your platform who onboard to Stripe with identity checks. It costs $2 per active account per month plus 0.25% + 25¢ per payout ([Connect pricing](https://stripe.com/connect/pricing)).
  - Railway, Neon, Vercel and the IRS will not become your connected accounts. They charge a card or send an invoice.
  - Using Connect to move your own revenue to yourself is not its purpose.

**What works: a business bank account with automatic percentage rules**

| Bank        | Percentage rules (verified)                                                                                                                                                                                      | Push to personal account                                                                                                                                                         | Cost                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mercury** | Rules based on a percentage of each incoming transaction ([help](https://support.mercury.com/hc/en-us/articles/48813587002004-How-percentage-based-auto-transfer-rules-are-calculated))                          | Auto-transfer to a Plaid-linked external account by ACH, 1–3 business days ([help](https://support.mercury.com/hc/en-us/articles/30470734281620-Setting-up-auto-transfer-rules)) | $0 base ([pricing](https://mercury.com/pricing)); **plan tier for rules unverified**                                                              |
| **Relay**   | Profit First rule sweeps an Income account into Profit/Tax/Owner's Comp/OpEx at editable percentages ([help](https://relayfi.com/hc/en-us/articles/13208655552532-Setting-up-and-managing-auto-transfer-rules/)) | **Unverified**                                                                                                                                                                   | Starter $0, Grow $30 ([third-party](https://www.nerdwallet.com/business/banking/reviews/relay-business-banking)); **rules on Starter unverified** |
| **Novo**    | Reserves route a percentage of deposits into buckets ([Novo](https://www.novo.co/business-savings-account))                                                                                                      | **Unverified**                                                                                                                                                                   | Free checking                                                                                                                                     |

**Setup steps**

1. Ask an accountant about the entity (LLC or sole proprietor), EIN and sales-tax registration. Tax on SaaS and digital services varies by state. Stripe Tax Basic costs 0.5% per transaction where you are registered.
2. Open a business account with Mercury or Relay. Create sub-accounts named **Income**, **Operating**, **Tax**, **Reserve** and **Owner Pay**.
3. Set Stripe's payout bank to **Income**, with daily or weekly payouts. Stripe fees are already deducted at that point.
4. Add a rule on each deposit to Income that moves the percentages below. On Relay, use the Profit First rule with a $0 maximum balance.
5. Issue a virtual card from **Operating**, and use it only for Vercel, Railway, Neon, Cloudflare, Resend, the VPS and the domain.
6. Schedule a monthly auto-transfer from **Owner Pay** to your personal bank as an owner draw.
7. Pay quarterly estimated taxes and any sales tax from **Tax**. If you collect sales tax, move the exact collected amount there, not a percentage.
8. Review quarterly. When Reserve holds 3 months of Operating costs, lower the Reserve percentage and add it to Owner Pay.

**Allocation derived from the model**

Scenario: 100 paid servers (70 Plus at $5, 25 Pro at $12, 5 Studio at $35), 400 free servers, bot on a VPS.

- Gross revenue $825. Stripe fees $59.70 (7.2%). **Payout $765.**
- Infrastructure is about $123 (baseline B $41 + VPS $24 + paid marginal $34 + free $24), which is **16% of payout**. The same scenario on Railway costs about $439 (57%).

| Account       | % of each payout | Covers                                                                                         |
| ------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| Operating     | **20%**          | Infrastructure (16%) + tools/headroom                                                          |
| Reserve       | **15%**          | Refunds, $15 chargebacks, price increases, 3-month runway                                      |
| Tax           | **25%**          | Income and self-employment tax set-aside (accountant to confirm; sales tax handled separately) |
| **Owner Pay** | **40%**          | What remains goes to your personal account                                                     |

**Before break-even** (fewer than about 12 paid servers), route **100% to Operating** until it holds 3 months of baseline (about $125–185). Then switch to the table.

**If the bot stays on Railway at this scale,** Operating needs about 60%, and Owner Pay falls to about 0–5%.

## Unverified or assumed

- **Railway:** Hobby commercial ban (2024 staff forum post only); Railway Postgres resource use.
- **Hetzner:** EU 20 TB traffic allowance and US €1/TB overage (third-party sources).
- **DigitalOcean:** $0.01/GiB overage (search summary of official docs).
- **Fly.io:** shared-CPU throttling behaviour.
- **Cloudflare Registrar:** .com price (third-party).
- **Discord:** "no fee" (no price page).
- **Bot resources:** voice overhead (22%), 8 MB and 0.004 vCPU per stream, 50% peak concurrency, 6 h/day playing, 5 vCPU-s per transcode. **Load-test the bot** (e.g. 50 concurrent streams in the test server) to replace these numbers.
- **Neon:** that pg-boss polling blocks scale-to-zero (inferred; check the Neon console's compute-hours graph).
- **Banks:** Relay plan required for rules and Relay/Novo push to external accounts; Mercury plan tier.
- **Other:** home PC wattage (60 W) and ISP data caps; state sales tax rules (not researched).

## Decisions for the founder

1. **Upgrade Vercel to Pro ($20) and Railway to Pro ($20) before taking the first payment.** Hobby tiers forbid commercial use.
2. **Fix Neon now.** Either move to Launch (about $19.35/mo always on) or move Postgres onto Railway inside the Pro credit (baseline about $41 vs $61). On Neon Free, pg-boss uses up the compute hours around day 17 and the database suspends.
3. **Move the bot to a $12 DigitalOcean droplet (or a Hetzner EU CX33 after a jitter test)** at about 40–50 active servers, or before promoting the free tier. Keep the worker on Railway.
4. **Load-test per-stream CPU and memory,** and plan one bot process per about 200 concurrent streams.
5. **Raise Plus to $5/mo; keep Pro $12 and Studio $35;** add annual plans at 10× monthly.
6. **Decide whether free workspaces may leave voice after 24 h empty.** This needs a PLAN_REVIEW.md change first.
7. **Open a Mercury or Relay business account** with Income → Operating 20% / Reserve 15% / Tax 25% / Owner Pay 40%, and 100% to Operating until break-even (about 8–12 paid servers).
8. **Book an accountant** for entity choice, sales-tax registration, whether to use Stripe Tax, and the tax percentage.
