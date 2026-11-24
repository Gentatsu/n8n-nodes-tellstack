# n8n-nodes-tellstack

n8n nodes for [Tellstack](https://tellstack.onibaku.co.uk), which finds the technologies behind any website (CMS, hosting, analytics, ecommerce and more, with the evidence) and lists the websites that use a technology.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Example](#example) · [Resources](#resources)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-tellstack`.

## Operations

**Tellstack Trigger**
- Starts the workflow when a watched domain changes, a website starts using a watched technology, or a bulk lookup finishes. n8n registers the webhook in Tellstack when you activate the workflow and removes it when you deactivate it. Each delivery is checked against its `Tellstack-Signature`.

**Tellstack**
- Domain, Look Up: the technologies a website uses, with version, confidence and evidence (1 credit).
- Domain, Get History: when technologies were added, removed or upgraded on a website.
- Technology, Get / Get Many: one technology, or search them by name or category (free).
- Technology, Get Websites: websites using a technology, most popular first, filtered by TLD, first-seen date or confidence (1 credit per 10 websites).
- Bulk Lookup, Create / Get / Get Results: look up to 10,000 domains in the background.
- Watch, Create / Delete / Get Many: watch a domain or a technology for the trigger.

The node can also be used as a tool by n8n's AI Agent. For any other endpoint, use the HTTP Request node with the predefined **Tellstack API** credential. See the [API reference](https://tellstack.onibaku.co.uk/docs).

## Credentials

Sign in at [tellstack.onibaku.co.uk/app](https://tellstack.onibaku.co.uk/app) and copy your API key (it starts with `tsk_`). Paste it into the **Tellstack API** credential in n8n. The free plan includes 100 lookups a month. The trigger needs a key with the `webhooks:write` scope.

## Example

Tellstack, Watch, Create (technology `shopify`) once, then Tellstack Trigger (Technology Added) → your CRM, so every website that moves to Shopify becomes a lead.

Or: Google Sheets (a column of domains) → Tellstack, Domain, Look Up → Google Sheets, writing back each site's CMS and hosting.

## Compatibility

Tested with n8n 2.x.

## Resources

- [Tellstack API reference](https://tellstack.onibaku.co.uk/docs)
- [n8n community nodes](https://docs.n8n.io/integrations/#community-nodes)

## Licence

[MIT](LICENSE.md)
