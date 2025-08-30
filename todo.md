# TODO.md

This document serves as a living, evolving backlog of all tasks required to take **VenekoVox** from idea to fully operational platform. Items are prioritized based on critical path and hackathon deliverability.

---

## ✅ DONE
- [x] Finalize product vision and name (VenekoVox)
- [x] Lock primary tech stack: Self.xyz (identity), MACI (zk voting), Gemini (frontend), IPFS (future roadmap)
- [x] Clone MACI starter repo and initialize local Git project
- [x] Generate UI mockups for 3+ pages (Landing, Poll List, Poll Detail, Trust Ritual, Conversation)
- [x] Define agents.md and readme.md for onboarding and continuity

---

## 🔥 HIGH PRIORITY
### 🧾 Self.xyz Integration
- [ ] Finalize MCP Server setup (local or hosted)
- [ ] Implement QR/deep link handshake into frontend (Trust Ritual page)
- [ ] Store non-invasive analytics (age/gender range if provided)
- [ ] Flag verification on frontend (visual cue for eligibility)

### 🗳️ MACI Deployment
- [ ] Review starter repo and subgraph template
- [ ] Deploy MACI contracts on testnet (Base/Optimism)
- [ ] Write custom integration logic (poll creation, vote casting)
- [ ] Test dummy zk circuit with mock poll + wallet

### 💻 Frontend Wiring
- [ ] Integrate Gemini mockups into actual pages
- [ ] Create router system to navigate between pages
- [ ] Hook live data from MACI and Self.xyz into UI states
- [ ] Ensure responsiveness across screen sizes

---

## 🚀 MEDIUM PRIORITY
### 📦 Filecoin Bounty Track
- [ ] Review SynapseSDK setup
- [ ] Store poll metadata & attached resources to IPFS/Filecoin
- [ ] Create retrieval logic for governance history
- [ ] Ensure links/files in poll context are timestamped

### 🧠 UX Innovation
- [ ] Comments section (decentralized Reddit-style flow)
- [ ] Analytics filters by demographic (via Self.xyz)
- [ ] “Primary Country” vs “Global” voting segmentation
- [ ] Explore alternative chain deployment (Lisk, Flare)

---

## 🛣️ LOW PRIORITY (ROADMAP)
- [ ] AI Agent that interviews citizens
- [ ] Smart stablecoin wallet (user gas abstraction)
- [ ] Social distribution hooks (sharing, remixing, reposting polls)
- [ ] ENS integrations, vote NFTs, retroactive airdrops

---

## 🧪 TESTING & DEPLOYMENT
- [ ] End-to-end tests for poll creation + voting flow
- [ ] Wallet connection + zk identity persistence
- [ ] Final audit of privacy flows
- [ ] Deployment to Vercel / IPFS

---

## ✨ NICE TO HAVE
- [ ] “Build from Exile” tagline (footer, readme, meta tags)
- [ ] “Supported by Ethereum Privacy Stewards” badge
- [ ] Poll linking to external sources
- [ ] Regional social proof (e.g. trending in Colombia)

---

Let's build the future of civic expression 🔥

