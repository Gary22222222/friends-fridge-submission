# Portal submission draft

**Project:** Friend's Fridge

**Live URL:** https://friends-fridge-jianghui.app.space

**Repository:** https://github.com/Gary22222222/friends-fridge-submission/tree/main

Friend's Fridge turns available ingredients into a dinner plan. Users maintain
private stock, choose what friends can see, discover recipes, and request an
ingredient handoff. Completing a handoff updates both inventories atomically;
recipe invitations and revocation keep shared access explicit. A fixed-size
fridge supports scrolling and an image-only view with empty stock shown gray.

DeepSpace native auth, Worker and SQLite Durable Objects handle identity,
authorization, inventory transactions and durable lookup state. Native
Anthropic provides reviewable photo suggestions. Native Apify retrieves
public online products and nearby shop listings; OpenWeather supports city
entry. Price matching, package conversion and budget arithmetic use program
rules, not an LLM. Results distinguish missing prices from over-budget meals.

The main tradeoff is a focused, bounded workspace: whole-pack costs are per
meal, online prices exclude tax/shipping/delivery eligibility, and nearby shops
have no live in-store prices. One inventory room keeps handoff transactions
understandable; larger usage needs indexed tables and retention policies.
Daily price allowances are visible and server-enforced. Cached quotes and
resuming the same job do not consume another attempt. Expired prices prompt
an explicit refresh rather than automatically starting a paid query.

The agent implemented and debugged the app, wrote targeted tests, prepared
deployments, and verified the release snapshot against the platform source.
Automated tests use native test identities and cover cross-account privacy,
friend requests, handoff idempotency, share revocation, scrolling, gray stock,
interrupted lookup recovery, expiry and the real public-price workflow.

**My own verification / changes:** _Replace with your actual observations._

Before submitting, personally check real Google/GitHub login, both sides of a
friend request and handoff, photo suggestions and correction, budget prices,
and phone scrolling. Do not describe agent automation as personal testing.

## Reviewable source

The root `release/deepspace.json` pairs the deployed cloud commit with its
platform release stamp and file hashes. Run
`python scripts/verify-deepspace-source.py --live` from the repository root.
DeepSpace is the sole deployment authority; the GitHub submission branch
contains the same application bytes, without pending development upgrades.
