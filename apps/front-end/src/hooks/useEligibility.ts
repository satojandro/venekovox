import { useCallback, useState } from "react";
import { clearEligibility, loadEligibility, type EligibilityRecord } from "../eligibility/storage";

/** Small React helper around sessionStorage eligibility. Not an authorization flag. */
export function useEligibility() {
  const [record, setRecord] = useState<EligibilityRecord | null>(() =>
    typeof sessionStorage === "undefined" ? null : loadEligibility(),
  );

  const refresh = useCallback(() => {
    setRecord(loadEligibility());
  }, []);

  const clear = useCallback(() => {
    clearEligibility();
    setRecord(null);
  }, []);

  return { record, refresh, clear };
}
