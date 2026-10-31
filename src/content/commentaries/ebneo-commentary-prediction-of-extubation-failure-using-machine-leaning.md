---
title: "EBNEO COMMENTARY: Prediction of Extubation Failure among Low Birthweight Neonates using Machine Learning"
slug: "ebneo-commentary-prediction-of-extubation-failure-using-machine-leaning"
publish_date: 2023-05-02
investigation: "Clinical prediction guides"
pmid: "36611107"
doi: ""
reviewer_email: "bbgandhi@bcm.edu"
status: published
---
## Citation

Natarajan A, Lam G, Liu J, Beam AL, Beam KS, Levin JC. Prediction of Extubation Failure among Low Birthweight Neonates using Machine Learning. J Perinatol 2023; 43:209–214. PMID [36611107](https://pubmed.ncbi.nlm.nih.gov/36611107/).

## Reviewed By

Bheru Gandhi MD  
Assistant Professor of Pediatrics  
Department of Pediatrics, Baylor College of Medicine/Division of Neonatology, Texas Children’s Hospital  
bbgandhi@bcm.edu

Joseph Hagan ScD  
Assistant Professor  
Baylor College of Medicine/Division of Neonatology, Texas Children’s Hospital

Monika Patil MD  
Associate Professor of Pediatrics  
Department of Pediatrics, Baylor College of Medicine/Division of Neonatology, Texas Children’s Hospital

## Investigation

Clinical prediction guides

## Question

In low birthweight (_<_ 2500 g) neonates (P) who were intubated and mechanically ventilated within the first 7 days of life (DOL), can a machine learning model (I) that combines demographic, medication, vital sign, and ventilator data accurately predict extubation failure versus success (O)?

## Methods

* **Design:** Retrospective cohort study
  * **Allocation:** All patients who met inclusion criteria were analyzed using the prediction model
  * **Blinding:** Unblinded
  * **Follow-up period:** Reintubation within 7 days of extubation attempt
  * **Setting:** Medical Information Mart for Intensive Care-III (MIMIC-III), a large open-source clinical database patients at a single center, Beth Israel Medical Center
  * **Patients:**
    * Admitted to the NICU between June 2001 to October 2012
    * Inclusion criteria: 
      * Birthweight _<_ 2500 g
      * Admitted to the neonatal intensive care unit within 24 hours of life (HOL)
      * Requiring mechanical ventilation in first 7 days of admission
    * Exclusion criteria: 
      * None (two infants without documented gestational age were excluded)
    * **Intervention:**
      * Data used in creating the extubation failure prediction models were divided into three distinct groups of features: patient demographics, medications, and vitals and ventilator support parameters.
      * For each of the two prediction methods, three separate models to predict extubation failure in the cohort were created using the features as follows: 1. Demographic features 2. Vital signs and ventilator settings, and 3. All features (demographic features + vital signs and ventilator settings features + medications features).
    * **Outcomes:** The primary outcome of interest was extubation failure within 7 days of the initial extubation attempt. Accuracy of the models in predicting this outcome was summarized as area under the receiver operating characteristic (AUROC) curve.
    * **Analysis and Sample Size:**
      * Two prediction methods were used to create predictive models of extubation failure in the cohort: 
        * Lasso logistic regression model
        * Gradient-boosted decision trees (XGBoost model) 
          * uses an iteratively generated ensemble of decision trees
        * Each model’s predictive accuracy was evaluated using fivefold nested cross-validation, with hyperparameters tuned via a separate internal fourfold cross-validation using the training data from the fivefold cross-validation.
        * Each model’s predictive accuracy was quantified by the mean and standard error (SE) AUROC over the five folds.
        * Receiver operating characteristic (ROC) curves and calibration plots were made for each model to assess accuracy in predicting extubation failure.
        * Sample size calculations were not done as data on all infants who met inclusion criteria were analyzed
      * **Patient follow-up:** There were 46,520 patients in the MIMIC-III database, of which 7840 were admitted within the first 24 HOL. One thousand, three hundred and fifty-three were ventilated, 1350 had birthweight of _<_ 2500 g. Of these, gestational age was available for 1348 infants, 998 had extubation success and 350 had extubation failure within 7 days of extubation event.

## Main Results

Table 1. Mean AUROC (SE) of the extubation failure models

| **Lasso logistic regression model mean AUROC (SE)** | **XGBoost model mean AUROC (SE)**  
---|---|---  
Patient demographics | 0.78 (<0.01) | 0.77 (0.01)  
Vital signs and ventilator readings | 0.74 (<0.01) | 0.76 (0.01)  
Demographics + medications + vitals and ventilator | 0.81 (<0.01) | 0.82 (<0.01)  
  
The model with the highest AUROC was the XGBoost model using all features. Table 2 is a 2 x 2 table where sensitivity represents the percent of successful extubations predicted and specificity represents the percent of failed extubations correctly predicted by the model. This is based on the assumption that the 929 predicted true positives was defined as predicted and actual successful extubation (not “predicted and actual failed extubations” as stated in the article) and 162 true negatives was defined as predicted failed and actual failed extubation. Attempts to clarify this with the article’s authors were unsuccessful.

Table 2. Summary of XGBoost model results to predict extubation success.

|  | Actual patient outcome  
---|---|---  
|  | Extubation success | Extubation failure  
XGBoost model prediction | Extubation success | 929 | 189  
Extubation failure | 69 | 162  
  
Patients in the extubation failure group had a lower mean birthweight and gestational age. Mean BW ± SD in the extubation success group was 1.68 ± 0.47 kg and 1.18 ± 0.45 kg in the failure group. Median (IQR) gestational age was 32 (30-25) weeks in the extubation success group and 28 (25-31) weeks in the failure group. Initial extubation attempts were performed later in the extubation failure patients. In addition, patients in the extubation failure group also were on mechanical ventilation for a longer period of time, 140 h vs 53 h. Patients in the failure group were more likely to receive vancomycin and caffeine. There were no significant differences in sex, ethnicity, receiving ampicillin or gentamicin.

In the demographics alone model, the magnitude of coefficient for the logistic regression model and shapely additive explanations (SHAP) values for the XGBoost model showed birthweight and gestational age as the most important factors in predicting extubation failure. In the model with all features combined, birthweight remained the most important feature in both models and caffeine was also important.

A sensitivity analysis done on 631 very low birth weight (VLBW) infants in the cohort, with the XGBoost model using all features (demographics + medications + vitals and ventilator data) performing the best, giving an AUROC of 0.77.

## Conclusion

This study showed it is possible to use a machine learning model that incorporates a large amount of data to identify low birth weight (_<_ 2500 g) neonates who are at risk for extubation failure in the first 7 DOL. The best performing model was the XGBoost model when taking into account patient demographics, medications, and vitals and ventilator readings.

## Commentary

Prolonged mechanical ventilation in neonates is associated with mortality and significant morbidity (1). As a result, best practices strive for early extubation and non-invasive ventilation techniques. Unfortunately, substantial evidence showing extubation readiness tests are not accurate (2). As a result, preterm newborns face the highest rates of reintubation (3). Predictive models using demographic and clinical data have recently shown limited ability to predict extubation success (3, 4, 5, 6). To be effective, these models need to have high specificity and sensitivity to predict extubation failure to avoid keeping infants intubated too long.

The APEX multicenter study showed a machine learning predictive model can help determine which infants will be successfully extubated versus those at higher risk for failure (3). Gupta et al. developed an extubation readiness tool combining demographic and clinical data to give an estimate of extubation success (4). To achieve an 80% probability of extubation success, their model had a sensitivity/specificity of 54%/81% (4). Their model was validated at an external site in another study with similar results (5).

In the current study, the XGBoost model combined the following variables: patient demographics + medications + vitals and ventilator readings, and predicted extubation success with 93.1% sensitivity, 46.2% specificity, 83.1% positive predictive value and 70.1% negative predictive value. Although the model performed well in detecting patients who will successfully extubate, the specificity in predicting extubation failure is less than 50%. There is an inconsistency in the data, however. Table 2, in the article, states the extubation failure as 350 cases, however, the false positive and true negatives combined result in a total extubation failure rate of 351. Attempts to clarify this discrepancy were unsuccessful.

The significant finding of the predictive model is promising but requires validation in a prospective multicenter study before adoption into clinical practice. To be optimally useful in the clinical setting, patients need to be identified in real time. Using sophisticated automated algorithms, future artificial intelligence (AI) tools should continuously analyze longitudinal vital signs and ventilator data faster for clinicians to intervene. Furthermore, extubation prediction models should factor in clinical variables such as ventilator days and non-respiratory comorbidities, such as sepsis, in determining likelihood of extubation success (7, 8).

As the data show, for infants <1500 g, the model did not perform better than others. Patients less than <1000 g and <27 weeks are the most at-risk population for whom more specific models should be developed. The authors concede that the time frame this cohort was analyzed, 2001-2012, respiratory practices were rapidly changing toward non-invasive ventilation which may further limit current clinical use.

With increasing use of EMR, real-time clinical data monitoring, and clinical decision support, advancing analytic techniques will affect patient outcomes (9). As technology progresses, AI platforms will be more sensitive to patient specific data that are not apparent to clinicians. This use of machine derived learning to develop predictive models using large amounts of clinical and patient data, while in its early stages, does demonstrate the potential to aid in promoting successful extubation.

## References

1. > Miller JD, Carlo WA. Pulmonary complications of mechanical ventilation in neonates. Clin Perinatol. 2008 Mar;35(1):273-81, x-xi.

  2. > Shalish W, Latremouille S, Papenburg J, Sant’Anna GM. Predictors of extubation readiness in preterm infants: a systematic review and meta-analysis. Arch Dis Child Fetal Neonatal Ed. 2019 Jan;104(1):F89-f97.

  3. > Kanbar LJ, Shalish W, Onu CC, Latremouille S, Kovacs L, Keszler M, et al. Automated prediction of extubation success in extremely preterm infants: the APEX multicenter study. Pediatric Research. 2022 2022/07/29.

  4. > Gupta D, Greenberg RG, Sharma A, Natarajan G, Cotten M, Thomas R, et al. A predictive model for extubation readiness in extremely preterm infants. J Perinatol. 2019 Dec;39(12):1663-69.

  5. > Dryer RA, Salem A, Saroha V, Greenberg RG, Rysavy MA, Chawla S, et al. Evaluation and validation of a prediction model for extubation success in very preterm infants. J Perinatol. 2022 Dec;42(12):1674-79.

  6. > Natarajan A, Lam G, Liu J, Beam AL, Beam KS, Levin JC. Prediction of extubation failure among low birthweight neonates using machine learning. Journal of Perinatology. 2023 2023/02/01;43(2):209-14.

  7. > Shalish W, Kanbar L, Keszler M, Chawla S, Kovacs L, Rao S, et al. Patterns of reintubation in extremely preterm infants: a longitudinal cohort study. Pediatr Res. 2018 May;83(5):969-75.

  8. > Shalish W, Keszler M, Kovacs L, Chawla S, Latremouille S, Beltempo M, et al. Age at First Extubation Attempt and Death or Respiratory Morbidities in Extremely Preterm Infants. J Pediatr. 2023 Jan;252:124-30.e3.

  9. > McAdams RM, Kaur R, Sun Y, Bindra H, Cho SJ, Singh H. Predicting clinical outcomes using artificial intelligence and machine learning in neonatal intensive care units: a systematic review. Journal of Perinatology. 2022 2022/12/01;42(12):1561-75.
