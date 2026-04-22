import { parseAbi } from 'viem';

export const OFT_ABI = parseAbi([
  'function peers(uint32 _eid) view returns (bytes32)',
  'function endpoint() view returns (address)',
  'function token() view returns (address)',
  'function approvalRequired() view returns (bool)',
  'function quoteSend((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, bool _payInLzToken) view returns ((uint256 nativeFee, uint256 lzTokenFee))',
] as const);

export const ERC20_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
] as const);
