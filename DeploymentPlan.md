# StreetMP Sovereign OS: Global Deployment Blueprint

## Executive Overview
StreetMP Sovereign OS is built for Tier-1 Financial Institutions to securely harness LLMs (OpenAI, Anthropic) without breaking PCI-DSS, SOC2, or internal compliance laws. This document outlines the infrastructure required to scale our secure enclave architecture to a massive Hub-and-Spoke fleet of 5,000+ Nitro Enclaves.

## Architecture: Hub-and-Spoke Model
To achieve hyper-scale global throughput (1.2+ TB/s) while maintaining zero-trust hardware isolation, StreetMP employs a Hub-and-Spoke topology across AWS availability zones.

### 1. The Control Plane (Hub)
- **Component:** Node.js Router & Express API
- **Location:** AWS EKS / ECS Fargate Clusters
- **Purpose:** API Gateway, Load Balancing, Vault ID mapping, Shamir Secret Custody (Share 2 & 3).
- **Scale:** Auto-scaling groups managing 100+ Pods globally.

### 2. The Data Plane (Spokes)
- **Component:** Rust Nitro Enclave (`nitro-tokenizer`)
- **Location:** AWS EC2 Virtual Machines with Nitro Enclaves activated (`c6a.xlarge` or similar).
- **Purpose:** Secure tokenization, Shamir Secret generation, Guardrail enforcement (Prompt Injection/Leakage).
- **Scale:** 5,000+ persistent ephemeral nodes distributed globally (us-east-1, eu-west-1, ap-south-1).

## One-Click Deploy Strategy (Terraform)

StreetMP OS provides a custom Terraform Provider (`terraform-provider-streetmp`) to orchestrate the fleet.

```hcl
terraform {
  required_providers {
    streetmp = {
      source = "streetmp/sovereign"
      version = "~> 2.0.0"
    }
  }
}

provider "streetmp" {
  api_key = var.streetmp_admin_key
}

# Define the Global Enclave Fleet
resource "streetmp_nitro_fleet" "global_cluster" {
  fleet_name         = "jpm-global-tokenizer"
  target_capacity    = 5000
  attestation_strict = true

  hubs = {
    us_east = {
      region   = "us-east-1"
      capacity = 2500
    }
    eu_west = {
      region   = "eu-west-1"
      capacity = 1500
    }
    ap_south = {
      region   = "ap-south-1"
      capacity = 1000
    }
  }

  security_policies {
    dp_epsilon                 = 0.5
    block_prompt_injection     = true
    block_mapping_reconstruction = true
  }

  vpc_config {
    subnet_ids = var.private_subnet_ids
    kms_key_id = aws_kms_key.customer_hyok.arn
  }
}
```

## Fleet Attestation & Health
When instances boot, they load the compiled Enclave Image Format (`.eif`) file. The Control Plane runs an automated cryptographic attestation loop against every spoke node.
- If the Platform Configuration Registers (PCRs) match the audited hash, the node is added to the load balancer pool.
- If a node is compromised, it is permanently dropped.

## Shamir Distributed Custody (HYOK)
By attaching your AWS KMS ARN to the `vpc_config`, the Control Plane transparently encrypts Share 2 and Share 3 with your Master Key. If you revoke the AWS IAM role, the entire global fleet of 5,000 nodes instantaneously collapses mathematics, permanently destroying access to all mapped PII.
