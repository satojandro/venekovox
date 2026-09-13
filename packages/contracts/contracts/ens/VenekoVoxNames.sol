// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Minimal ENSv2 Beta ABI, checked against ensdomains/contracts-v2 on 2026-09-07.
/// See docs/ens-registration.md for upstream links and deployment compatibility gates.
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

interface INamingMaci {
  function getPoll(uint256 pollId) external view returns (address, address, address);
}

/// @notice Candidate Sepolia subname registrar and narrow ENS resolver.
/// @dev Names are public, optional and unrelated to Self/MACI eligibility.
/// Parent registry administrators retain their ENSv2 powers. This is not a
/// guarantee of permanent ownership or global nontransferability.
contract VenekoVoxNames {
  error InvalidConfiguration();
  error InvalidLabel();
  error NameUnavailable();
  error AlreadyNamed();
  error OperatorOnly();
  error InvalidPoll();
  error ReentrantCall();

  event ProfileClaimed(address indexed account, bytes32 indexed node, string label);
  event PollNamed(uint256 indexed pollId, bytes32 indexed node, string label, address poll);

  INameRegistryV2 public immutable profileRegistry;
  INameRegistryV2 public immutable pollRegistry;
  address public immutable operator;
  address public immutable maci;
  uint64 public immutable registrationExpiry;
  bytes32 public immutable profileParentNode;
  bytes32 public immutable pollParentNode;
  string public profileParent;
  string public pollParent;

  struct Entry {
    string label;
    address owner;
    bool isPoll;
    string pollRecord;
    uint256 resource;
  }
  mapping(bytes32 => Entry) private entries;
  mapping(address => bytes32) public profileNode;
  mapping(uint256 => bytes32) public pollNode;
  bool private entering;

  constructor(
    address profiles,
    address polls,
    string memory profileSuffix,
    string memory pollSuffix,
    bytes32 profileHash,
    bytes32 pollHash,
    address admin,
    address maciAddress,
    uint64 expiry
  ) {
    if (
      block.chainid != 11155111 ||
      profiles.code.length == 0 ||
      polls.code.length == 0 ||
      profiles == polls ||
      admin == address(0) ||
      maciAddress.code.length == 0 ||
      profileHash == bytes32(0) ||
      pollHash == bytes32(0) ||
      profileHash == pollHash ||
      bytes(profileSuffix).length == 0 ||
      bytes(pollSuffix).length == 0 ||
      expiry <= block.timestamp
    ) revert InvalidConfiguration();
    profileRegistry = INameRegistryV2(profiles);
    pollRegistry = INameRegistryV2(polls);
    profileParent = profileSuffix;
    pollParent = pollSuffix;
    profileParentNode = profileHash;
    pollParentNode = pollHash;
    operator = admin;
    maci = maciAddress;
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
    // ENSIP-15 reserves the third/fourth-position double hyphen (including xn--).
    if (value.length >= 4 && value[2] == "-" && value[3] == "-") return false;
    for (uint256 i; i < value.length; i++) {
      bytes1 c = value[i];
      if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "-")) return false;
    }
    return true;
  }

  function available(string calldata label, bool isPoll) public view returns (bool) {
    if (!validLabel(label) || block.timestamp >= registrationExpiry) return false;
    bytes32 node = keccak256(abi.encodePacked(isPoll ? pollParentNode : profileParentNode, keccak256(bytes(label))));
    if (entries[node].owner != address(0)) return false;
    INameRegistryV2 registry = isPoll ? pollRegistry : profileRegistry;
    return registry.getState(uint256(keccak256(bytes(label)))).status == 0;
  }

  function claimProfile(string calldata label) external nonReentrant returns (bytes32 node) {
    if (profileNode[msg.sender] != bytes32(0)) revert AlreadyNamed();
    node = _register(label, false);
    profileNode[msg.sender] = node;
    emit ProfileClaimed(msg.sender, node, label);
  }

  /// @notice The operator selects a real deployed poll; its address is read from MACI.
  function namePoll(string calldata label, uint256 pollId) external nonReentrant returns (bytes32 node) {
    if (msg.sender != operator) revert OperatorOnly();
    if (pollNode[pollId] != bytes32(0)) revert AlreadyNamed();
    (address poll, , ) = INamingMaci(maci).getPoll(pollId);
    if (poll.code.length == 0) revert InvalidPoll();
    node = _register(label, true);
    // Embedded JSON uses single-quoted Solidity strings to avoid escape noise.
    // solhint-disable quotes
    entries[node].pollRecord = string.concat(
      '{"version":1,"chainId":"11155111","maci":"',
      _hex(maci),
      '","pollId":"',
      _decimal(pollId),
      '","poll":"',
      _hex(poll),
      '"}'
    );
    // solhint-enable quotes
    pollNode[pollId] = node;
    emit PollNamed(pollId, node, label, poll);
  }

  function _register(string calldata label, bool isPoll) private returns (bytes32 node) {
    if (!validLabel(label)) revert InvalidLabel();
    if (!available(label, isPoll)) revert NameUnavailable();
    node = keccak256(abi.encodePacked(isPoll ? pollParentNode : profileParentNode, keccak256(bytes(label))));
    INameRegistryV2 registry = isPoll ? pollRegistry : profileRegistry;
    // No owner transfer, resolver-edit or delegation roles in this candidate.
    // Atomic register + records avoids parent-resolver permission delegation.
    registry.register(label, msg.sender, address(0), address(this), 0, registrationExpiry);
    uint256 resource = registry.getState(uint256(keccak256(bytes(label)))).resource;
    entries[node] = Entry(label, msg.sender, isPoll, "", resource);
  }

  function _active(bytes32 node) private view returns (bool) {
    Entry storage entry = entries[node];
    if (entry.owner == address(0)) return false;
    INameRegistryV2 registry = entry.isPoll ? pollRegistry : profileRegistry;
    INameRegistryV2.State memory state = registry.getState(uint256(keccak256(bytes(entry.label))));
    return
      state.status == 2 &&
      state.resource == entry.resource &&
      state.expiry > block.timestamp &&
      state.latestOwner == entry.owner &&
      registry.getResolver(entry.label) == address(this);
  }

  /// @notice Application-scoped account recovery, not an ENS global primary name.
  function profileName(address account) external view returns (string memory) {
    bytes32 node = profileNode[account];
    return
      entries[node].owner == account && _active(node) ? string.concat(entries[node].label, ".", profileParent) : "";
  }

  function addr(bytes32 node) external view returns (address) {
    return _active(node) ? entries[node].owner : address(0);
  }

  function text(bytes32 node, string calldata key) external view returns (string memory) {
    if (keccak256(bytes(key)) != keccak256("xyz.venekovox.poll") || !_active(node)) return "";
    return entries[node].pollRecord;
  }

  function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
    return interfaceId == 0x01ffc9a7 || interfaceId == 0x3b3b57de || interfaceId == 0x59d1d43c;
  }

  function _hex(address value) private pure returns (string memory) {
    bytes memory result = new bytes(42);
    bytes memory alphabet = "0123456789abcdef";
    result[0] = "0";
    result[1] = "x";
    for (uint256 i; i < 40; i++) result[41 - i] = alphabet[(uint160(value) >> (4 * i)) & 15];
    return string(result);
  }

  function _decimal(uint256 value) private pure returns (string memory) {
    if (value == 0) return "0";
    uint256 n = value;
    uint256 length;
    while (n != 0) {
      length++;
      n /= 10;
    }
    bytes memory result = new bytes(length);
    while (value != 0) {
      result[--length] = bytes1(uint8(48 + (value % 10)));
      value /= 10;
    }
    return string(result);
  }
}
