import copy
import unittest
from identity_review import apply_review


class ReviewGuards(unittest.TestCase):
    def setUp(self):
        self.occ = [{'id': 'p#1', 'researcherId': 'a', 'name': 'A', 'institution': 'X'},
                    {'id': 'q#1', 'researcherId': 'b', 'name': 'A', 'institution': 'Y'}]
        self.decision = {'name': 'A', 'decision': 'merge_all', 'status': 'user_confirmed',
                         'evidence': 'User confirmed', 'existingGroupIds': ['a', 'b'],
                         'occurrenceIds': ['p#1', 'q#1']}

    def apply(self, **patch):
        d = {**self.decision, **patch}
        return apply_review(copy.deepcopy(self.occ), {'decisions': [d]})

    def test_reject_conflicting_separation(self):
        with self.assertRaisesRegex(ValueError, 'separation'):
            self.apply(cannotLink=[{'left': 'a', 'right': 'b'}])

    def test_reject_stale_occurrences(self):
        with self.assertRaisesRegex(ValueError, 'no longer match'):
            self.apply(occurrenceIds=['p#1'])

    def test_reject_unknown_group(self):
        with self.assertRaisesRegex(ValueError, 'Unknown'):
            self.apply(existingGroupIds=['a', 'missing'])

    def test_reject_merging_pending(self):
        with self.assertRaisesRegex(ValueError, 'Deferred'):
            self.apply(deferredGroupIds=['b'])

    def test_require_explicit_merge_and_evidence(self):
        for patch in [{'decision': 'defer_all'}, {'status': 'awaiting_research'}, {'evidence': ''}]:
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                self.apply(**patch)

    def test_correction_cannot_silently_match_nothing(self):
        with self.assertRaisesRegex(ValueError, 'no longer matches'):
            self.apply(affiliationCorrections=[{'from': 'missing', 'to': 'Y'}])


if __name__ == '__main__':
    unittest.main(verbosity=2)
