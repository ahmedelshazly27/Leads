# Legal: the short must-do list before launch

The other files in this folder (LEGAL_MEMO, AD_RULES, VENDOR_CONTRACTS,
TRADEMARK) are the full drafts for a lawyer. This page is the short version,
written for the **merchant-of-record** setup the owner chose: a payment
provider (Paddle first, Stripe Managed Payments as backup) is the legal seller,
collects and pays the Gulf VAT, and issues the invoices. The B.V. sells to the
provider the way any foreign app does, like ordering from an overseas site.

## Not needed with a merchant of record
- VAT registration in the UAE, Saudi Arabia, Bahrain or Oman.
- A tax representative, a bank guarantee, or Arabic tax invoices (the provider
  issues the invoices).
- A Gulf company, trade licence or local bank account.

## Must do (in order)
1. **Paddle approval in writing.** Describe the product honestly: on-device
   measurement, a person reviews every report, AI illustrations of the
   customer's own face, a 12-month plan. No approval → try Stripe Managed
   Payments, then PayPro Global or FastSpring.
2. **Click-through data agreements (DPAs)**, all online, no negotiation:
   Supabase, Vercel (move to the Pro plan), Resend, the payment provider, and
   one image provider that agrees in writing not to store or train on photos.
3. **Reviewer contract** signed before any reviewer sees a photo (outline in
   VENDOR_CONTRACTS.md section 2).
4. **Self-host the fonts** and drop the remote MediaPipe fallback, so no
   customer data goes to Google.
5. **Fill the placeholders** in the legal pages: B.V. name, KvK number,
   address, contact email, image provider, backup window. Then name the
   payment provider as the seller in the terms and refunds pages.
6. **Trademark.** One Benelux filing for WADDAH before ad spend. Ask a
   trademark attorney first whether وضّاح is registrable in the Gulf: a Riyadh
   AI company already uses "وضاح / Waddah AI" (classes 9, 42).
7. **Ads.** Follow the do/don't table in AD_RULES.md section 2: no AI
   before/after images in ads, no medical or "scientifically proven" claims,
   no "your face is …" copy, Arabic or bilingual creatives. Hold UAE- and
   Kuwait-targeted ads until a lawyer answers the two questions there
   (UAE advertiser permit; Kuwait Decree-Law 10/2026). Saudi, Qatar, Bahrain,
   Oman: no permit found for our own page's ads.
8. **Data-protection impact assessment** (one page, because face photos are
   sensitive). Template in LEGAL_MEMO.md.

## Countries
- **Open at launch:** Saudi Arabia, UAE (checkout); Kuwait once a Kuwaiti
  lawyer confirms the 2026 digital-commerce law needs no registration.
- **Hold:** Oman (data permit for face photos, up to 45 days) and Qatar (a
  lawyer first checks whether its data law reaches us). Bahrain's only blocker
  was VAT, so with a merchant of record it can open with Saudi Arabia.
- **Later:** the rest of MENA, one country at a time.

## One lawyer question list, not five firms
Send LEGAL_MEMO.md section 4 to one Gulf firm with Kuwait, Saudi and UAE
coverage. The questions that decide launch order: Kuwait registration, the UAE
advertiser permit, Oman's data permit, Qatar's data law, and whether the age
gate should be 21 in Kuwait.
