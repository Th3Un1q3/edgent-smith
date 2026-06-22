#!/bin/sh

# Function to search for TODOs
search_todos() {
    flag=$1
    echo "--- TODOs in $2 Changes ---"
    
    # Get the list of files into a temporary variable
    # We use tr '\0' '\n' to convert the null-delimited list to a newline list
    # for safer iteration in standard shell
    files=$(git diff $flag --name-only --diff-filter=d)
    
    if [ -z "$files" ]; then
        echo "No modified files."
    else
        # Iterate through each file and grep individually
        # This avoids all issues with xargs argument limits or syntax
        found=0
        for file in $files; do
            if [ -f "$file" ]; then
                matches=$(grep -n "TODO" "$file")
                if [ -n "$matches" ]; then
                    echo "$file:"
                    echo "$matches"
                    found=1
                fi
            fi
        done
        
        if [ "$found" -eq 0 ]; then
            echo "No TODOs found."
        fi
    fi
    echo ""
}

# Run searches
search_todos "" "Unstaged"
search_todos "--cached" "Staged"