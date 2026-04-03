use rand::thread_rng;
use rand_distr::{Laplace, Distribution};
use std::sync::atomic::{AtomicUsize, Ordering};

/// DP Privacy Budget (Epsilon)
/// Lower ε = more privacy (more noise), less accuracy.
/// Higher ε = less privacy (less noise), higher accuracy.
const TELEMETRY_EPSILON: f64 = 0.5;

/// Global atomic counters for execution telemetry
static SANITIZE_COUNT: AtomicUsize = AtomicUsize::new(0);
static DESANITIZE_COUNT: AtomicUsize = AtomicUsize::new(0);
static REJECTION_COUNT: AtomicUsize = AtomicUsize::new(0);

/// Adds exactly one execution to the sanitize counter.
pub fn record_sanitize() {
    SANITIZE_COUNT.fetch_add(1, Ordering::Relaxed);
}

/// Adds exactly one execution to the desanitize counter.
pub fn record_desanitize() {
    DESANITIZE_COUNT.fetch_add(1, Ordering::Relaxed);
}

/// Records a blocked execution (e.g., prompt injection or model leakage).
pub fn record_rejection() {
    REJECTION_COUNT.fetch_add(1, Ordering::Relaxed);
}

/// Applies ε-Differential Privacy via Laplace noise to an exact count.
/// Formula: output = true_value + Laplace(0, scale)
/// where scale = sensitivity / epsilon.
/// For counting queries, sensitivity = 1.
fn add_laplace_noise(true_value: usize, epsilon: f64) -> usize {
    if true_value == 0 {
        return 0; // Don't add noise to zero to prevent fake anomalies at startup
    }

    let scale = 1.0 / epsilon;
    let laplace = Laplace::new(0.0, scale).expect("Invalid Laplace params");
    let mut rng = thread_rng();
    
    let noise: f64 = laplace.sample(&mut rng);
    let noisy_value = (true_value as f64 + noise).round();

    // Counts cannot be negative
    if noisy_value < 0.0 {
        0
    } else {
        noisy_value as usize
    }
}

/// Retrieves the current noisy metrics for the dashboard.
pub fn get_noisy_telemetry() -> (usize, usize, usize) {
    let exact_sanitize = SANITIZE_COUNT.load(Ordering::Relaxed);
    let exact_desanitize = DESANITIZE_COUNT.load(Ordering::Relaxed);
    let exact_rejections = REJECTION_COUNT.load(Ordering::Relaxed);

    let noisy_sanitize = add_laplace_noise(exact_sanitize, TELEMETRY_EPSILON);
    let noisy_desanitize = add_laplace_noise(exact_desanitize, TELEMETRY_EPSILON);
    let noisy_rejections = add_laplace_noise(exact_rejections, TELEMETRY_EPSILON);

    (noisy_sanitize, noisy_desanitize, noisy_rejections)
}
