export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* Fall through to the older selection path. */
  }
  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

export function sepoliaTxUrl(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}
