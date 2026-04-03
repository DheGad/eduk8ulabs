# System Resolution Protocols (StreetMP OS)

## Support Topic: High Token Burn Rate
**Symptoms**: Alert webhook fired for `>90% Token Cap Reached`. Tenant requests limit increase or diagnostics.
**Resolution Protocol**:
1. Check `quotaManager.getTenantQuotaStatus` to verify if the threshold alert is genuine.
2. Confirm if the tenant runs batch data pipelines (often spike without leaking).
3. If confirmed legitimate business use, trigger the V57 Cap Increase automated workflow or advise the tenant to upgrade their package on the dashboard. Do NOT automatically lift caps without an owner signature.

## Support Topic: BFT Consensus Quorum Failures
**Symptoms**: Proxy returns 502 with `bft_quorum_failed`. Node disagreements on AI responses.
**Resolution Protocol**:
1. This is a V48 Cognitive Quorum event and is generally a sign of adversarial prompt injection attempting to poison a single LLM backend.
2. Instruct the tenant to review their latest prompts. 
3. Re-run the prompt through the `diagnostics` route to see which specific node (e.g. `gpt-4o` vs `claude-3-5`) is dissenting. 
4. Assure the tenant this is the system functioning correctly to prevent hallucinations.

## Support Topic: Hardware Enclave Desynchronization (PCR)
**Symptoms**: Admin alerts show `FATAL_ENCLAVE_COMPROMISE` resulting in 403 Forbidden on all external connections.
**Resolution Protocol**:
1. Identify the compromised Nitro Enclave using `attestationEngine.verifyEnclaveIntegrity`.
2. Do NOT attempt to restart the pod manually. The cluster will self-heal according to standard Kubernetes policies.
3. If the host stays cordoned for more than 15 minutes, page the Infrastructure SRE team to issue a zero-trust node rotation.
