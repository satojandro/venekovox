// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IBasePolicy } from "@excubiae/contracts/contracts/interfaces/IBasePolicy.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Candidate issuer-backed MACI policy, NOT direct Self proof verification.
/// @dev One instance per signup OR poll-join target. Issuer/config/action are immutable.
/// Issuer trust, document uniqueness and recovery semantics require approval before deployment.
contract SelfEligibilityPolicy is IBasePolicy, Ownable, EIP712 {
  struct Authorization {
    address account;
    address target;
    bytes32 identityTag;
    bytes32 configId;
    bytes32 action;
    bytes32 nonce;
    uint64 issuedAt;
    uint64 expiresAt;
  }

  bytes32 public constant AUTHORIZATION_TYPEHASH =
    keccak256(
      "Authorization(address account,address target,bytes32 identityTag,bytes32 configId,bytes32 action,bytes32 nonce,uint64 issuedAt,uint64 expiresAt)"
    );
  uint64 public constant MAX_LIFETIME = 15 minutes;
  address public immutable issuer;
  bytes32 public immutable configId;
  bytes32 public immutable action;
  address public guarded;
  mapping(bytes32 => bool) public usedIdentityTags;
  mapping(address => bool) public usedAccounts;

  error InvalidAuthorization();
  error InvalidLifetime();
  error InvalidIssuer();

  // Identity tags/signatures are already visible in calldata. Avoid duplicating them in logs.
  event AuthorizationConsumed(address indexed account, address indexed target);

  constructor(
    address owner_,
    address issuer_,
    bytes32 configId_,
    bytes32 action_
  ) Ownable(owner_) EIP712("VenekoVox Self Eligibility", "1") {
    if (issuer_ == address(0) || configId_ == bytes32(0) || action_ == bytes32(0)) revert InvalidAuthorization();
    issuer = issuer_;
    configId = configId_;
    action = action_;
  }

  function trait() external pure returns (string memory) {
    return "VenekoVoxSelfIssuerV1";
  }

  /// @dev Target can be bound once after MACI/Poll deployment resolves its address.
  function setTarget(address target) external onlyOwner {
    if (guarded != address(0)) revert TargetAlreadySet();
    if (target == address(0) || target.code.length == 0) revert InvalidAuthorization();
    guarded = target;
    emit TargetSet(target);
  }

  function authorizationDigest(Authorization memory a) public view returns (bytes32) {
    return
      _hashTypedDataV4(
        keccak256(
          abi.encode(
            AUTHORIZATION_TYPEHASH,
            a.account,
            a.target,
            a.identityTag,
            a.configId,
            a.action,
            a.nonce,
            a.issuedAt,
            a.expiresAt
          )
        )
      );
  }

  /// @dev MACI passes the actual caller as subject. Never use tx.origin here.
  /// Consumed state rolls back if the enclosing signup/join subsequently reverts.
  function enforce(address subject, bytes calldata evidence) external {
    if (guarded == address(0)) revert TargetNotSet();
    if (msg.sender != guarded) revert TargetOnly();
    (Authorization memory a, bytes memory signature) = abi.decode(evidence, (Authorization, bytes));
    if (
      subject == address(0) ||
      a.account != subject ||
      a.target != guarded ||
      a.configId != configId ||
      a.action != action ||
      a.identityTag == bytes32(0) ||
      a.nonce == bytes32(0)
    ) {
      revert InvalidAuthorization();
    }
    if (
      a.issuedAt > block.timestamp ||
      a.expiresAt <= block.timestamp ||
      a.expiresAt <= a.issuedAt ||
      a.expiresAt - a.issuedAt > MAX_LIFETIME
    ) revert InvalidLifetime();
    if (ECDSA.recover(authorizationDigest(a), signature) != issuer) revert InvalidIssuer();
    if (usedIdentityTags[a.identityTag] || usedAccounts[subject]) revert AlreadyEnforced();
    usedIdentityTags[a.identityTag] = true;
    usedAccounts[subject] = true;
    emit AuthorizationConsumed(subject, guarded);
  }
}
