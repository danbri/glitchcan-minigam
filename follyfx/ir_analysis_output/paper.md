# Principal Component Analysis of Acoustic Impulse Responses: Discovering Interpretable Latent Dimensions

**Authors:** Anonymous
**Date:** January 2026
**Keywords:** impulse response, PCA, SVD, room acoustics, dimensionality reduction

---

## Abstract

We investigate whether principal component analysis (PCA) can discover interpretable perceptual dimensions in acoustic impulse responses (IRs). Using 115 real-world IRs from the EchoThief library, we compare two approaches: (1) SVD directly on time-domain waveforms, and (2) PCA on extracted acoustic features. We find that feature-based PCA successfully recovers three interpretable axes—*clarity*, *spectral brightness*, and *bass content*—capturing 85% of variance in just three components. In contrast, raw waveform SVD spreads variance thinly across many components (31% in first 10 PCs) and correlates poorly with perceptual acoustic properties. These results suggest that while raw SVD on IRs is mathematically valid, it captures recording artifacts rather than room acoustics, and that feature engineering remains essential for interpretable IR parameterization.

---

## 1. Introduction

Impulse responses (IRs) characterize the acoustic properties of physical spaces and are widely used in convolution reverb, acoustic simulation, and audio post-production. A natural question arises: **can we discover a compact, interpretable parameterization of IRs through unsupervised learning?**

Ideally, we would like to find axes such as:
- *"Size-ness"* — small room vs. cathedral
- *"Material-ness"* — hard/reflective vs. soft/absorptive
- *"Brightness-ness"* — dark vs. bright spectral character

Previous work in parametric reverb design (Välimäki et al.) decomposes IRs into physically meaningful components (early reflections, modal resonances, late diffuse tail), but this is model-driven rather than data-driven. We ask: **what does pure SVD on a corpus of IRs reveal?**

### 1.1 Research Questions

1. Does SVD on raw IR waveforms yield interpretable principal components?
2. How does this compare to PCA on engineered acoustic features?
3. Do unsupervised clusters correspond to semantic room categories?

---

## 2. Methods

### 2.1 Dataset

We used the **EchoThief Impulse Response Library**, containing 115 IRs recorded in diverse real-world locations across 8 categories:

| Category | Count | Examples |
|----------|-------|----------|
| Underground | 25 | Subways, tunnels |
| Underpasses | 23 | Highway underpasses |
| Miscellaneous | 26 | Various indoor/outdoor |
| Stairwells | 7 | Building stairwells |
| Brutalism | 11 | Concrete architecture |
| Nature | 11 | Canyons, caves |
| Venues | 5 | Concert halls, theaters |
| Recreation | 7 | Gyms, pools |

All IRs were resampled to 44.1 kHz and truncated/padded to 2 seconds (88,200 samples).

### 2.2 Experiment 1: Raw Waveform SVD

Each IR was treated as an 88,200-dimensional vector. The data matrix **X** ∈ ℝ^(115×88200) was:
1. L2-normalized (removing gain differences)
2. Mean-centered
3. Decomposed via SVD: **X** = **UΣV**ᵀ

The rows of **V**ᵀ represent "eigen-IRs"—orthogonal basis functions that capture maximum variance.

### 2.3 Experiment 2: Feature-Based PCA

We extracted 11 standard acoustic features from each IR:

| Feature | Description |
|---------|-------------|
| RT60 | Reverberation time (T30 extrapolated) |
| EDT | Early decay time |
| C50, C80 | Clarity ratios (early/late energy) |
| D50 | Definition (early energy fraction) |
| Ts | Centre time |
| Spectral centroid | Frequency-weighted mean |
| Spectral rolloff | 85% energy frequency |
| Bass ratio | Low/mid frequency energy ratio |
| Early reflection density | Zero-crossings in first 80ms |
| Peak-to-tail ratio | Direct sound vs. tail amplitude |

The feature matrix **F** ∈ ℝ^(115×11) was standardized and decomposed via SVD.

### 2.4 Clustering and Visualization

We applied K-means clustering (k=6) and t-SNE visualization to both the raw SVD loadings (**U**[:, 1:8]) and feature PCA scores (**U**[:, :5]).

---

## 3. Results

### 3.1 Variance Explained

<div class="figure" id="fig-variance">

**Figure 1: Variance explained by principal components**

| Component | Raw SVD | Feature PCA |
|-----------|---------|-------------|
| PC1 | 8.0% | **52.6%** |
| PC2 | 6.3% | **25.7%** |
| PC3 | 3.4% | **7.1%** |
| PC4 | 2.8% | 5.8% |
| PC5 | 2.3% | 4.3% |
| **Cumulative (PC1-3)** | **17.7%** | **85.4%** |
| **Cumulative (PC1-10)** | **31.2%** | **99.4%** |

</div>

The feature-based approach achieves dramatic dimensionality reduction: 3 components capture 85% of variance. Raw SVD spreads variance across many components, suggesting high intrinsic dimensionality or noise dominance.

### 3.2 Component Interpretation

#### Feature PCA Components

**PC1 (52.6% variance): "Clarity/Definition"**
- High loadings: C50 (-0.40), C80 (-0.40), D50 (-0.39)
- Low loadings: Ts (+0.38)
- Interpretation: **Dry/direct ↔ Wet/reverberant**

**PC2 (25.7% variance): "Spectral Brightness"**
- High loadings: Spectral centroid (+0.55), Spectral rolloff (+0.55), Early reflection density (+0.51)
- Low loadings: Bass ratio (-0.34)
- Interpretation: **Dark ↔ Bright**

**PC3 (7.1% variance): "Bass Content"**
- Dominated by: Bass ratio (-0.91)
- Interpretation: **Boomy ↔ Thin**

#### Raw SVD Components

The raw SVD components show weak correlations with acoustic features:

| Feature | PC1 | PC2 | PC3 | PC4 | PC5 |
|---------|-----|-----|-----|-----|-----|
| RT60 | -0.15 | -0.09 | +0.09 | +0.19 | -0.03 |
| Spectral rolloff | **-0.49** | -0.15 | -0.29 | +0.09 | +0.09 |
| Spectral centroid | **-0.38** | -0.14 | -0.34 | +0.09 | +0.14 |
| C80 | -0.01 | +0.11 | -0.22 | -0.22 | -0.04 |

Raw PC1 correlates most strongly with spectral features, not reverb time. This suggests it captures frequency response variations (possibly microphone/recording differences) rather than room acoustics.

### 3.3 Eigen-IR Analysis

The first 5 eigen-IRs (rows of **V**ᵀ) share common characteristics:

| Eigen-IR | Peak Time | Early Energy (0-50ms) | Spectral Centroid |
|----------|-----------|----------------------|-------------------|
| PC1 | 0.4 ms | 98.3% | 2,763 Hz |
| PC2 | 0.6 ms | 98.2% | 3,546 Hz |
| PC3 | 0.3 ms | 96.9% | 5,174 Hz |
| PC4 | 0.5 ms | 94.4% | 4,230 Hz |
| PC5 | 0.5 ms | 92.8% | 5,427 Hz |

All eigen-IRs concentrate energy in the early portion (>92% in first 50ms), with progressively higher spectral centroids. This indicates raw SVD primarily captures variations in direct sound and early reflections, with successive components representing higher-frequency content.

### 3.4 Cluster Analysis

K-means clusters (k=6) on feature PCA scores show partial correspondence with EchoThief categories:

<div class="figure" id="fig-clusters">

**Figure 2: Cluster composition**

| Cluster | Size | Dominant Categories |
|---------|------|---------------------|
| 0 | 9 | Nature (44%), Miscellaneous (22%) |
| 1 | 31 | Brutalism (26%), Underground (26%), Miscellaneous (19%) |
| 2 | 11 | Nature (45%), Miscellaneous (18%) |
| 3 | 30 | Miscellaneous (40%), Underground (17%) |
| 4 | 12 | Underground (58%), Stairwells (25%) |
| 5 | 22 | Underpasses (55%), Miscellaneous (18%) |

</div>

Clusters 4 and 5 show category coherence (Underground/Stairwells and Underpasses respectively), but most clusters are heterogeneous. This suggests **EchoThief categories are semantic/visual rather than acoustic**—a stairwell and an underpass may have similar acoustic properties despite different labels.

### 3.5 Cross-Space Correlation

Correlation between raw SVD and feature PCA components is weak:

|  | F-PC1 | F-PC2 | F-PC3 | F-PC4 | F-PC5 |
|--|-------|-------|-------|-------|-------|
| R-PC1 | 0.03 | **0.40** | 0.00 | 0.13 | 0.26 |
| R-PC2 | 0.06 | 0.15 | 0.01 | 0.08 | 0.10 |
| R-PC3 | 0.20 | 0.27 | 0.00 | 0.21 | 0.12 |

The strongest correlation (0.40) is between raw PC1 and feature PC2 (brightness), consistent with raw SVD capturing spectral characteristics.

---

## 4. Discussion

### 4.1 Why Raw SVD Fails

Our hypothesis for the poor performance of raw waveform SVD:

1. **Alignment problem**: IRs have different effective lengths. Zero-padding creates artificial structure that SVD must model.

2. **Phase sensitivity**: SVD on time-domain signals finds components that minimize L2 error, but small phase shifts between IRs create large L2 differences while being perceptually negligible.

3. **Recording artifacts**: Microphone frequency response, noise floor, and gain variations dominate over room acoustic properties.

4. **High intrinsic dimensionality**: The late reverb tail is essentially filtered noise, which has high dimensionality that SVD cannot compress efficiently.

### 4.2 Why Feature PCA Succeeds

Feature extraction acts as a **perceptually-informed bottleneck**:
- RT60, C80, etc. are designed to capture human-audible properties
- They are invariant to phase, gain, and many recording artifacts
- The feature space is low-dimensional by construction (11D vs 88,200D)

The discovered axes—clarity, brightness, bass—correspond to well-known perceptual dimensions in room acoustics literature.

### 4.3 Implications for IR Parameterization

For applications requiring interpretable IR control (e.g., audio plugins, game audio):
- **Use feature-based representations**, not raw waveforms
- **3 parameters suffice** to capture 85% of acoustic variation
- Categories like "cathedral" or "bathroom" may not map cleanly to acoustic space

### 4.4 Limitations

- Dataset limited to 115 IRs from one source
- Synthetic IR generation for interpolation not tested
- Perceptual validation (listening tests) not performed
- Alternative decompositions (NMF, autoencoders) not compared

---

## 5. Conclusion

We find that **SVD on raw IR waveforms does not yield interpretable acoustic dimensions**. Variance is spread across many components that correlate with spectral/recording properties rather than perceptual room characteristics.

In contrast, **PCA on acoustic features successfully discovers three interpretable axes**:
1. **Clarity** (dry ↔ reverberant)
2. **Brightness** (dark ↔ bright)
3. **Bass content** (boomy ↔ thin)

These three dimensions capture 85% of variance in 115 real-world IRs, suggesting a practical parameterization for reverb design and acoustic space interpolation.

Future work should:
- Validate with perceptual experiments
- Test interpolation in feature space for IR morphing
- Compare with learned representations (variational autoencoders)
- Apply to larger, more diverse IR corpora

---

## References

1. Välimäki, V., Parker, J. D., Savioja, L., Smith, J. O., & Abel, J. S. (2012). Fifty years of artificial reverberation. *IEEE Transactions on Audio, Speech, and Language Processing*, 20(5), 1421-1448.

2. ISO 3382-1:2009. Acoustics — Measurement of room acoustic parameters.

3. EchoThief Impulse Response Library. http://www.echothief.com/

4. Jot, J. M. (1999). Real-time spatial processing of sounds for music, multimedia and interactive human-computer interfaces. *Multimedia Systems*, 7(1), 55-69.

5. Pätynen, J., Tervo, S., & Lokki, T. (2008). Analysis of concert hall acoustics via visualizations of time-frequency and spatiotemporal responses. *The Journal of the Acoustical Society of America*, 123(5), 3806.

---

## Appendix A: Extreme Examples

| Property | IR Name | Category | Value |
|----------|---------|----------|-------|
| Most reverberant | FatMansSqueeze | Nature | PC1 = -0.18 |
| Most direct/dry | SquareVictoriaDome | Underground | PC1 = +0.21 |
| Brightest | LittlefieldLobby | Miscellaneous | PC2 = +0.22 |
| Darkest | ConventionCenterSteps | Stairwells | PC2 = -0.16 |

---

## Appendix B: Reproducibility

Code and data available at: `./ir_analysis_output/`

```
ir_analysis_output/
├── analysis_results.npz      # NumPy archive with all matrices
├── eigen_irs/                # Eigen-IR audio files (WAV)
│   ├── eigen_ir_pc1.wav
│   └── ...
├── cluster_comparison.png
├── interpretation_summary.png
└── eigen_ir_analysis.png
```

To reproduce:
```bash
python3 ir_pca_analysis.py
```
