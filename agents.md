# 🤖 VenekoVox AI Agent Collaboration Guide

## 👋 Welcome, Builder!

This document serves as your comprehensive guide for collaborating with **Cline** (me!) on the VenekoVox project. Whether you're a new contributor joining the movement or continuing where we left off, this guide will help us work together effectively to build the future of civic expression.

---

## 🎯 Project Overview

**VenekoVox** is a privacy-first, civic-native protocol empowering Latin American communities with secure, anonymous polling. Built on MACI (Minimal Anti-Collusion Infrastructure) with Self.xyz identity verification, we're creating tamper-proof, censorship-resistant civic engagement tools.

### Current Status
- ✅ **Vision & Tech Stack**: Finalized (Self.xyz + MACI + React + IPFS)
- ✅ **Repository**: Initialized from MACI starter
- ✅ **UI Mockups**: Created for core pages
- 🚧 **High Priority**: Self.xyz integration, MACI deployment, Frontend wiring

### Tech Stack Summary
- **Frontend**: React + Tailwind + Vite
- **Identity**: Self.xyz (zk-verified anonymous ID)
- **Privacy Protocol**: MACI + Semaphore
- **Blockchain**: Ethereum-compatible (Base/Optimism/Lisk)
- **Storage**: IPFS + Filecoin (future)
- **AI Assistant**: Cline (that's me!)

---

## 🤝 How to Work with Cline

### Communication Style
- **Direct & Technical**: I communicate clearly and concisely, focusing on actionable steps
- **Tool-Driven**: I use specific tools for different tasks (reading files, writing code, running commands)
- **Iterative**: I work step-by-step, waiting for confirmation after each action

### Best Practices for Collaboration
1. **Be Specific**: When asking for help, provide clear context about what you need
2. **Reference Files**: Mention specific files or functions when relevant
3. **Prioritize**: If multiple tasks exist, indicate which is most urgent
4. **Review Changes**: Always review my code suggestions before implementation

### What I Can Help With
- ✅ Code implementation and debugging
- ✅ Architecture planning and design
- ✅ Testing and quality assurance
- ✅ Documentation and onboarding
- ✅ Git workflow and best practices
- ✅ Integration with external APIs/services

---

## 🏗️ Technical Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Identity      │    │   Voting        │
│   (React)       │◄──►│   (Self.xyz)    │◄──►│   Protocol      │
│                 │    │                 │    │   (MACI)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User          │    │   ZK Proofs     │    │   Smart         │
│   Interface     │    │   Generation    │    │   Contracts     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow
1. **Identity Verification**: User proves eligibility via Self.xyz (geographic/demographic)
2. **Poll Participation**: Anonymous voting through MACI protocol
3. **Result Aggregation**: ZK proofs ensure privacy while enabling public verification
4. **Storage**: Poll metadata and results stored immutably (IPFS/Filecoin future)

### Key Integration Points
- **Self.xyz MCP Server**: Handles identity verification and QR code generation
- **MACI Contracts**: Deployed on testnet for voting functionality
- **Frontend State**: Manages user flow from identity verification to poll participation

---

## 🚀 Development Workflow

### Git Strategy
```
main (production-ready)
├── develop (integration branch)
│   ├── feature/self-xyz-integration
│   ├── feature/maci-deployment
│   └── feature/frontend-wiring
```

### Branch Naming Convention
- `feature/[description]`: New features
- `fix/[description]`: Bug fixes
- `docs/[description]`: Documentation updates
- `refactor/[description]`: Code refactoring

### Commit Message Format
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(auth): implement Self.xyz QR handshake
```

### Code Quality Standards
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React/TypeScript
- **Prettier**: Consistent code formatting
- **Testing**: Unit tests for critical functions, E2E for user flows

---

## 🎯 Current Priorities & Next Steps

### 🔥 HIGH PRIORITY

#### 1. Self.xyz Integration
- [ ] Set up MCP Server (local or hosted)
- [ ] Implement QR/deep link handshake in Trust Ritual page
- [ ] Store non-invasive analytics (age/gender ranges)
- [ ] Add visual verification flags in UI

#### 2. MACI Deployment
- [ ] Review starter repo and subgraph template
- [ ] Deploy contracts on testnet (Base/Optimism)
- [ ] Write custom integration logic for polls
- [ ] Test with dummy zk circuit and mock data

#### 3. Frontend Wiring
- [ ] Integrate Gemini mockups into actual pages
- [ ] Create router system for page navigation
- [ ] Connect live data from MACI and Self.xyz
- [ ] Ensure mobile responsiveness

### 🚀 MEDIUM PRIORITY

#### Filecoin Integration
- [ ] Review SynapseSDK setup
- [ ] Implement IPFS/Filecoin storage for poll metadata
- [ ] Create retrieval logic for governance history
- [ ] Add timestamp verification for external links

#### UX Enhancements
- [ ] Comments section for public discourse
- [ ] Demographic analytics filters
- [ ] Geographic segmentation (country vs global)
- [ ] Alternative chain exploration (Lisk, Flare)

---

## 🧪 Testing & Deployment

### Testing Strategy
- **Unit Tests**: Core business logic and utilities
- **Integration Tests**: API endpoints and external service connections
- **E2E Tests**: Complete user flows (identity → voting → results)
- **Security Tests**: Privacy guarantees and sybil resistance

### Deployment Pipeline
1. **Development**: Local testing with mock services
2. **Staging**: Testnet deployment with real contracts
3. **Production**: Mainnet deployment with monitoring

### Environment Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Run tests
pnpm test

# Build for production
pnpm build
```

---

## 🔧 Troubleshooting Guide

### Common Issues

#### Self.xyz Integration
- **Issue**: MCP Server connection fails
- **Solution**: Verify server configuration and network connectivity
- **Debug**: Check server logs and API endpoints

#### MACI Deployment
- **Issue**: Contract deployment fails on testnet
- **Solution**: Ensure sufficient testnet funds and correct network configuration
- **Debug**: Use Hardhat console for detailed error messages

#### Frontend Connectivity
- **Issue**: API calls fail between frontend and services
- **Solution**: Verify CORS settings and environment variables
- **Debug**: Check browser network tab and server logs

### Getting Help
1. Check this document first
2. Review existing issues in the repository
3. Ask Cline for specific technical assistance
4. Join our Discord for community support

---

## 📚 Resources & Documentation

### Core Documentation
- [MACI Protocol](https://maci.pse.dev/docs/quick-start)
- [Self.xyz Integration](https://docs.self.xyz)
- [Filecoin Storage](https://docs.filecoin.io)
- [Base Network](https://docs.base.org)

### Development Tools
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Build Tool](https://vitejs.dev)

### Testing Resources
- [Jest Testing Framework](https://jestjs.io)
- [React Testing Library](https://testing-library.com/docs/react-testing-library)
- [Hardhat for Smart Contracts](https://hardhat.org)

---

## 🎉 Success Metrics

### Technical Milestones
- [ ] Self.xyz identity verification working end-to-end
- [ ] MACI voting protocol deployed and tested
- [ ] Frontend fully wired with real data
- [ ] Mobile-responsive design complete
- [ ] Comprehensive test coverage achieved

### Impact Goals
- [ ] Enable secure anonymous polling for Latin American communities
- [ ] Demonstrate privacy-preserving civic engagement
- [ ] Create foundation for broader decentralized governance tools
- [ ] Build sustainable open-source infrastructure

---

## 🤝 Contributing Guidelines

### Code Contributions
1. Create feature branch from `develop`
2. Implement changes with tests
3. Ensure code quality standards are met
4. Submit pull request with clear description
5. Address review feedback promptly

### Documentation Updates
- Keep this `agents.md` current as project evolves
- Update `todo.md` with completed tasks
- Document new features and integrations
- Maintain clear API documentation

### Community Engagement
- Share progress on Discord and social media
- Welcome new contributors with clear onboarding
- Maintain transparency in decision-making
- Celebrate milestones and learnings

---

## 🚀 Future Roadmap

### Phase 2: Enhanced Features
- AI-powered poll generation and analysis
- Multi-language support (Spanish + Portuguese)
- Advanced analytics and sentiment analysis
- Integration with additional identity providers

### Phase 3: Scaling & Adoption
- Multi-chain deployment strategy
- Mobile app development
- Institutional partnerships
- Global expansion beyond Latin America

---

## 📞 Contact & Support

- **Discord**: Join our community channel
- **GitHub Issues**: Report bugs and request features
- **Cline**: Your AI development assistant (that's me!)
- **Email**: For sensitive communications

---

*Built with ❤️ by the VenekoVox team. This is just the beginning of a movement for dignified, secure civic expression worldwide.*

**🌱 Build from exile. Speak with dignity. Govern with truth.**
