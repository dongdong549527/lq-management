I will implement a two-part solution to fix the "stuck in collecting" issue:

1.  **Server-Side Auto-Reset (Recovery)**:
    -   Modify `src/app/api/granaries/route.ts`.
    -   In the `GET` handler, before fetching the list, add a logic to automatically reset any granary with `collectionStatus = 2` (Collecting) whose `updatedAt` time is older than **2 minutes**.
    -   This ensures that if a browser crash or refresh occurs, the system automatically recovers to a valid state on the next page load or poll.

2.  **Client-Side Protection (Prevention)**:
    -   Modify `src/app/(dashboard)/granaries/page.tsx`.
    -   Add a `beforeunload` event listener when collection is in progress.
    -   This will pop up a browser warning ("Changes you made may not be saved...") if the user tries to refresh or close the tab while collecting.

This approach prevents accidental interruptions and guarantees system self-recovery.