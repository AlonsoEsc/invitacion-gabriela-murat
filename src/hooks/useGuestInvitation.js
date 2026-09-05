import { useEffect, useState } from "react";
import { getInvitation } from "../services/rsvpService.js";

export function useGuestInvitation(token) {
  const [state, setState] = useState({ status: token ? "loading" : "missing", invitation: null, error: null });

  useEffect(() => {
    let active = true;

    if (!token) {
      setState({ status: "missing", invitation: null, error: null });
      return undefined;
    }

    setState({ status: "loading", invitation: null, error: null });
    getInvitation(token)
      .then((invitation) => {
        if (active) setState({ status: "ready", invitation, error: null });
      })
      .catch((error) => {
        if (!active) return;
        const status = error.message === "not-found" ? "not-found" : error.message === "firebase-not-configured" ? "unavailable" : "error";
        setState({ status, invitation: null, error });
      });

    return () => {
      active = false;
    };
  }, [token]);

  return state;
}
