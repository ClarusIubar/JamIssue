# Comment Performance Fix

## What Changed

This change set addressed the comment slowdown in four linked layers instead of treating it as a single hot spot.

1. The feed, place-review, and my-page review collections now store review summaries without embedded comment trees.
2. The active comment sheet now loads and owns its comment thread separately from the feed list.
3. `CommentThread` no longer re-normalizes the full tree on every keystroke, and the main composer is isolated from the rendered list.
4. Comment mutation flows now update `commentCount` from the full tree size instead of the root-node count, and backend notification unread counts are fetched in one grouped query.

## Follow-up Review Fixes

The post-change review found a few regressions, and they were fixed in the same branch.

1. Reopening a cached comment sheet now reuses cached comments for instant paint but still refetches in the background so new replies and notification deep-links do not get stuck on stale thread data.
2. Review edit flows now write summarized reviews back into my-page review state instead of re-embedding full comment trees.
3. Backend `commentCount` now follows the same visible-thread rules as the comment API, including soft-deleted comments that disappear entirely and deleted parents that stay visible only while a live reply still exists.
4. Windows-local backend test runs now pin `pytest` temp directories and cache output to repo-local paths because the default `tmp_path` handling on this machine produced unreadable temp folders under Python 3.13.

## Why The Tests Changed

The test changes are intentional and required by the behavior change.

- A new frontend unit test covers `countCommentsInThread()` and summary stripping so we do not regress back to root-only comment counts or accidentally re-embed comment trees into feed state.
- A new hook-level frontend unit test verifies that editing a review keeps `myPage.reviews` summary-only even when the API response still contains embedded comments.
- The `ReviewList` regression test now asserts against `commentCount` instead of `comments.length` because the feed list intentionally no longer depends on embedded thread data.
- Backend repository tests now verify both that `list_reviews()` omits the comment tree by default and that its `commentCount` matches the visible thread semantics after soft delete.
- A Windows-only `backend/tests/conftest.py` tempdir shim was added so `python -m pytest tests` can run reliably on this machine without changing product behavior or the assertion logic inside the tests.

These test updates are necessary because the old assertions encoded the pre-fix architecture, where review list items always carried full comment trees.

## Validation Target

GitHub Actions `ci.yml` is the baseline for this work:

- Frontend: `npm run typecheck`, `npm run build`
- Backend: `python -m pytest tests`

Additional targeted Vitest coverage was added locally to lock the new comment behavior in place.
