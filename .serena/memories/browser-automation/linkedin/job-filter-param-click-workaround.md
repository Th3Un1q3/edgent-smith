# LinkedIn Job Search: f_WT / f_TPR Filter-Param Click Workaround

LinkedIn job-search filters mirror URL params (e.g., `f_WT` work-type, `f_TPR` time-range). The
filter controls are React-controlled hidden inputs: a synthetic click() on them may be silently
ignored (no state change, no effect).

If a click shows no effect, ONE bounded navigate_page with the param set in the URL is acceptable.
Check the site address-bar tolerance first - rapid address-bar navigation is itself a bot signal
on some sites (devtools-known-issues #17, wellfound pattern).