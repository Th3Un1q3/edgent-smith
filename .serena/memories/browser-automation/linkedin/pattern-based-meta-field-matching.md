# LinkedIn Extraction: Match Meta Fields by Regex Role, Not Position

On LinkedIn (and similar) cards, meta fields sit in conditional spans - e.g., attribution text may
appear BEFORE view counts, shifting positional indexes. Match meta fields by regex role instead of
positional index:

- View counts: `/^[0-9.,KMB]+ views?$/`
- Relative timestamps: `/ago|year|month|week|day|hour/`

Regex-role matching survives attribution/layout drift that breaks index-based reads.