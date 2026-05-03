suits = ['S', 'H', 'D', 'C']
ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K']

expected = {}
for r in ranks:
    for s in suits:
        expected[r + s] = 2

# My rough transcription
board = [
  ["JOKER", "KH", "QC", "10S", "9D", "8H", "7C", "6D", "5D", "JOKER"],
  ["10H", "10C", "9S", "8D", "7H", "AD", "2D", "3D", "4D", "5D"],
  ["9H", "9C", "8C", "7D", "6H", "AC", "2C", "3C", "4C", "5C"],
  ["8H", "8S", "7C", "6D", "10D", "AH", "2H", "3H", "4H", "5H"],
  ["7H", "7S", "6C", "QH", "4D", "AS", "2S", "3S", "4S", "5S"],
  ["5S", "4C", "AD", "6H", "2H", "3H", "KH", "KS", "KD", "KC"],
  ["4S", "5C", "2D", "8S", "AC", "2C", "QH", "QS", "QD", "QC"],
  ["3S", "6C", "3D", "6S", "7D", "AS", "10H", "10S", "10D", "10C"],
  ["KS", "QS", "QD", "KC", "KD", "8C", "9H", "9S", "9D", "9C"],
  ["JOKER", "AH", "2S", "3C", "4H", "5H", "6S", "7S", "8D", "JOKER"]
]

actual = {}
errors = False

for r in range(10):
    for c in range(10):
        card = board[r][c]
        if card == "JOKER": continue
        actual[card] = actual.get(card, 0) + 1

print("Duplicates > 2:")
for k, v in actual.items():
    if v > 2:
        print(f"  {k}: {v}")
        errors = True

print("Missing or < 2:")
keys_found = 0
for k, v in expected.items():
    if actual.get(k, 0) < 2:
        print(f"  {k}: expected 2, found {actual.get(k, 0)}")
        errors = True
    if actual.get(k, 0) == 2:
        keys_found += 1

print(f"\nTotal unique valid cards exactly 2 times: {keys_found} (should be 48)")
if not errors:
    print("BOARD IS PERFECT!")
