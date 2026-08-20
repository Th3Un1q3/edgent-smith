# LinkedIn Company Page: Employee-Count Label Scope

LinkedIn company pages show employee counts at multiple scopes. Distinguish global totals from
regional lines such as N employees work in Germany - never conflate them (known bug pattern in
extraction).

Range-form counts (e.g., 1K-5K, 501-1K) are normal on the page - record them as-is; do not
normalize or guess a midpoint.