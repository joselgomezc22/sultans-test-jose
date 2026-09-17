# Shopify Admin API — Interview Tasks

## Setup

```
npm install
cp .env.example .env
```

Then fill in `.env` with your store's credentials:

- `SHOPIFY_STORE` — your `*.myshopify.com` domain
- `SHOPIFY_API_VERSION` — the Admin API version to target (e.g. `2026-04`)
- `SHOPIFY_ADMIN_TOKEN` — a custom app's Admin API access token

## Task 1 – Leaderboard

`src/leaderboard.ts` does a simple GraphQL query against the Shopify Admin API to pull the top 50 customers tagged `tag:task1 AND tag:level:3`, along with their `amountSpent`. The results get sorted by amount spent (highest first) and written out as a CSV into `data/`, using the [export-to-csv](https://www.npmjs.com/package/export-to-csv) library.

Run it with:

```
npm run task1
```

## Task 2 – Capture the Flag

This one was more complex.

My very first idea was the simplest one: just try adding the product to the cart via the browser console with `fetch('/cart/add.js', ...)`. It failed — sold out is sold out, the storefront won't add it regardless.

Next I tried the direct route: create the order with the `orderCreate` mutation (`src/manual-order.ts`). That failed too — the token doesn't have the `write_orders` scope, so `orderCreate` was never going to work. I confirmed this by checking the full scope list with `src/scopes-list.ts`.

So I went after the inventory instead. The product ("Task 2 Flag") was sold out, so I wrote `src/set-inventory.ts` to set the variant's available quantity directly via `inventorySetQuantities`. The mutation ran fine, no errors — but the storefront kept showing the product as sold out anyway.

To figure out why, I wrote `src/diagnose.ts` to query the variant's live inventory numbers (`available` / `on_hand` / `committed`) directly. After a few rounds of setting the inventory and immediately re-checking it, I noticed the pattern: something was resetting the available quantity back down (sometimes into the negatives) within seconds of my write. It wasn't a sync delay — it was an active process undoing the change.

Since a single well-timed write wasn't reliable, I widened the window instead of trying to time one perfect shot:

- In the browser console, I ran a polling loop that hit `/cart/add.js` every 250ms and redirected straight to `/checkout` on the first successful add:

  ```js
  let tries = 0;
  const poll = setInterval(async () => {
    tries++;
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 42795733614707, quantity: 1 })
    });
    const data = await res.json();
    if (res.ok && !data.status) {
      clearInterval(poll);
      window.location.href = '/checkout';
    }
  }, 250);
  ```

- At the same time, I ran `set-inventory.ts` on a loop from the terminal, forcing the available quantity back up once a second for about 20 seconds:

  ```bash
  for i in $(seq 1 20); do
    npx tsx src/set-inventory.ts
    sleep 1
  done
  ```

With both loops running at once, one of the polling attempts landed inside a window where the inventory was actually positive — the add-to-cart succeeded and the browser redirected to checkout. From there I completed the purchase manually in the storefront (it's a $0 item, so no payment step needed) and got the order confirmation email.
