// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CallerProbe
/// @notice W1 E2/E3 diagnostic: records who the *contract* saw, not who broadcast the outer transaction.
///
/// Sponsored / smart-account execution can make those two different:
/// - `msg.sender` is the account the Poll will treat as the participant.
/// - `tx.origin` is the EOA that started the call chain (often a relayer, sometimes the user).
/// - The outer transaction's `from`/`to` live only in the receipt, not here.
///
/// This contract does not implement MACI. It exists so the experiment can observe
/// caller identity before we touch signup / join / publish.
contract CallerProbe {
  event Probed(address indexed caller, address indexed origin, uint256 gasPrice, bytes data);

  address public lastCaller;
  address public lastOrigin;
  uint256 public lastGasPrice;
  bytes public lastData;

  /// @notice Record this call's identity. Safe to call with zero ETH.
  function probe() external payable returns (address caller, address origin, uint256 gasPrice) {
    caller = msg.sender;
    origin = tx.origin;
    gasPrice = tx.gasprice;
    lastCaller = caller;
    lastOrigin = origin;
    lastGasPrice = gasPrice;
    lastData = msg.data;
    emit Probed(caller, origin, gasPrice, msg.data);
  }

  /// @notice Always reverts. Used by E3 to distinguish an inner call failure from outer-tx success.
  function alwaysRevert() external pure {
    revert("W1_PROBE_REVERT");
  }
}

/// @title ProbeForwarder
/// @notice A tiny stand-in for a relayer / account wrapper.
/// A direct EOA call to `CallerProbe` makes `msg.sender == tx.origin`.
/// Forwarding through this contract makes `msg.sender` the forwarder while `tx.origin`
/// stays the original EOA — the same *shape* sponsored execution can produce.
contract ProbeForwarder {
  event InnerCallFailed(bytes reason);

  function forwardProbe(CallerProbe probe) external payable {
    probe.probe();
  }

  /// @notice Call `alwaysRevert` and swallow the error so the *outer* transaction still succeeds.
  /// This is the local analogue of "bundler transaction mined, user operation failed".
  function forwardRevertCatching(CallerProbe probe) external {
    try probe.alwaysRevert() {} catch (bytes memory reason) {
      emit InnerCallFailed(reason);
    }
  }
}
