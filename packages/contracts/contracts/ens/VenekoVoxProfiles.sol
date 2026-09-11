// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Sepolia ENSv2 named-account registrar. Registers a label on a UserRegistry.
/// @dev The participating account deploys its own Permissioned Resolver and writes records.
///      This contract only calls UserRegistry.register. It must not receive resolver roles.
///      A name labels a wallet account, not a unique human. It never grants vote eligibility.
interface INameRegistryV2 {
  struct State {
    uint8 status;
    uint64 expiry;
    address latestOwner;
    uint256 tokenId;
    uint256 resource;
  }

  function getState(uint256 anyId) external view returns (State memory);

  function getResolver(string calldata label) external view returns (address);

  function register(
    string calldata label,
    address owner,
    address subregistry,
    address resolver,
    uint256 roles,
    uint64 expiry
  ) external returns (uint256);
}

interface IVerifiableFactory {
  function verifyContract(address proxy) external view returns (address implementation);
}

contract VenekoVoxProfiles {
  error InvalidConfiguration();
  error InvalidLabel();
  error InvalidResolver();
  error NameUnavailable();
  error AlreadyNamed();
  error ReentrantCall();

  event ProfileClaimed(address indexed account, bytes32 indexed node, string label, address resolver);

  /// @dev Registry ROLE_SET_RESOLVER so the owner can later retarget the resolver pointer.
  ///      Transfer and unregister are omitted unless Alejandro later chooses otherwise.
  uint256 public constant OWNER_REGISTRY_ROLES = 1 << 24;

  INameRegistryV2 public immutable profileRegistry;
  IVerifiableFactory public immutable factory;
  address public immutable resolverImpl;
  address public immutable operator;
  uint64 public immutable registrationExpiry;
  bytes32 public immutable profileParentNode;
  string public profileParent;

  struct Entry {
    string label;
    address owner;
  }

  mapping(bytes32 => Entry) private entries;
  mapping(address => bytes32) public profileNode;
  bool private entering;

  constructor(
    address profiles,
    string memory profileSuffix,
    bytes32 profileHash,
    address admin,
    uint64 expiry,
    address factory_,
    address resolverImpl_
  ) {
    if (
      profiles.code.length == 0 ||
      factory_.code.length == 0 ||
      resolverImpl_.code.length == 0 ||
      admin == address(0) ||
      profileHash == bytes32(0) ||
      bytes(profileSuffix).length == 0 ||
      expiry <= block.timestamp
    ) revert InvalidConfiguration();
    profileRegistry = INameRegistryV2(profiles);
    factory = IVerifiableFactory(factory_);
    resolverImpl = resolverImpl_;
    profileParent = profileSuffix;
    profileParentNode = profileHash;
    operator = admin;
    registrationExpiry = expiry;
  }

  modifier nonReentrant() {
    if (entering) revert ReentrantCall();
    entering = true;
    _;
    entering = false;
  }

  /// @dev ASCII subset of normalized ENS labels; identical client restriction.
  function validLabel(string memory label) public pure returns (bool) {
    bytes memory value = bytes(label);
    if (value.length < 3 || value.length > 32 || value[0] == "-" || value[value.length - 1] == "-") return false;
    if (value.length >= 4 && value[2] == "-" && value[3] == "-") return false;
    for (uint256 i; i < value.length; i++) {
      bytes1 c = value[i];
      if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "-")) return false;
    }
    return true;
  }

  function available(string calldata label) public view returns (bool) {
    if (!validLabel(label) || block.timestamp >= registrationExpiry) return false;
    bytes32 node = keccak256(abi.encodePacked(profileParentNode, keccak256(bytes(label))));
    if (entries[node].owner != address(0)) return false;
    return profileRegistry.getState(uint256(keccak256(bytes(label)))).status == 0;
  }

  /// @notice Register `label` to `msg.sender` with `resolver` already deployed by that account.
  /// @dev Does not write addr/text records. Those are owner transactions on the resolver.
  function claimProfile(string calldata label, address resolver) external nonReentrant returns (bytes32 node) {
    if (profileNode[msg.sender] != bytes32(0)) revert AlreadyNamed();
    if (!validLabel(label)) revert InvalidLabel();
    if (!available(label)) revert NameUnavailable();
    if (resolver.code.length == 0) revert InvalidResolver();
    if (factory.verifyContract(resolver) != resolverImpl) revert InvalidResolver();
    node = keccak256(abi.encodePacked(profileParentNode, keccak256(bytes(label))));
    entries[node] = Entry(label, msg.sender);
    profileNode[msg.sender] = node;
    profileRegistry.register(label, msg.sender, address(0), resolver, OWNER_REGISTRY_ROLES, registrationExpiry);
    emit ProfileClaimed(msg.sender, node, label, resolver);
  }

  /// @notice Application-scoped recovery of the claimed label. Not an ENS primary name.
  /// @dev Returns the name when this account still owns the registry token. Record
  ///      completeness (addr / theme) is a client "ready" check, not this mapping.
  function profileName(address account) external view returns (string memory) {
    bytes32 node = profileNode[account];
    Entry storage entry = entries[node];
    if (entry.owner != account) return "";
    INameRegistryV2.State memory state = profileRegistry.getState(uint256(keccak256(bytes(entry.label))));
    if (state.status != 2 || state.latestOwner != account || state.expiry <= block.timestamp) return "";
    return string.concat(entry.label, ".", profileParent);
  }
}
