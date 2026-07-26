# max-unlimited-violation

This E2E test asserts the correct Battlescribe behavior for constraints where `type="max"` and `value="-1"`.

In Battlescribe, a `max` constraint with a value of `-1` indicates that the selection is "unlimited" (there is no upper bound). Therefore, having more than 0 selections should **never** trigger this constraint.

## The Bug
The current evaluator engine evaluates constraints by checking `actual <= bound`. When `bound` is `-1`, it checks `actual <= -1`. Since `actual` (e.g., 21 Goblins) is always greater than `-1`, the engine incorrectly reports a constraint violation.

## Scenario
We load the `Orcs and goblins (6th definitive edition).cat` which has a Goblin selection entry with a `max="-1"` constraint (`ad41-8936-7a56-1717`). 
In `01-goblin-unlimited.ros`, we add 21 Goblins to the roster. 

The test asserts that the constraint `ad41-8936-7a56-1717` is `absent` (i.e. NO violation is emitted).
When run against the buggy engine, this test will **fail**, demonstrating that the engine incorrectly fires the constraint.
