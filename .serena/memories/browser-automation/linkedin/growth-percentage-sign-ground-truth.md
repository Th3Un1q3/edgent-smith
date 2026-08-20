# LinkedIn Company Page: Growth Percentage Sign - Chart Points Are Ground Truth

The rendered growth percentage on LinkedIn company pages has NO sign or arrow: Growth trends 14% can
mean +14% OR -14%. The chart data points are ground truth for direction - always compute direction
from the first/last points.

During the 2026-08-19 campaign, 7 wrong-sign values (incl. Software AG, which read 14% but was
actually -14%) were fixed by comparing chart points. If points decline, growth is negative even
when the label shows a plain number.

Related: mem:browser-automation/linkedin/company-growth-chart-points-extraction.
Campaign source: mem:researches/german-it-companies/lessons-learned.