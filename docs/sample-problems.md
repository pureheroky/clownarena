# Sample Problems For Clown Arena

Ниже два простых задания для быстрого наполнения MVP. У каждого есть:
- title
- description
- input/output spec
- constraints
- visible examples
- hidden and edge tests
- reference solution на Python

---

## Problem 1: Longest Equal Run

### Title
`Longest Equal Run`

### Difficulty
`2`

### Description
You are given a sequence of integers. Find the length of the longest contiguous block that contains only one repeated value.

If all numbers are different, the answer is `1`.

### Input spec
The first line contains one integer `n` — the length of the sequence.

The second line contains `n` integers.

### Output spec
Print one integer — the length of the longest contiguous block of equal numbers.

### Constraints
- `1 <= n <= 200000`
- Each number fits in a signed 32-bit integer.

### Examples

#### Example 1
Input:
```text
8
1 1 2 2 2 3 3 1
```

Output:
```text
3
```

Explanation:
The longest block is `2 2 2`.

#### Example 2
Input:
```text
5
7 7 7 7 7
```

Output:
```text
5
```

### Tests

#### Sample test
Input:
```text
6
4 4 1 1 1 2
```

Expected output:
```text
3
```

#### Hidden test
Input:
```text
7
5 1 1 1 1 2 2
```

Expected output:
```text
4
```

#### Hidden test
Input:
```text
4
9 8 7 6
```

Expected output:
```text
1
```

#### Edge test
Input:
```text
1
42
```

Expected output:
```text
1
```

### Reference solution
```python
import sys


def solve(data: str) -> str:
    parts = data.strip().split()
    if not parts:
        return "0"

    n = int(parts[0])
    numbers = list(map(int, parts[1:1 + n]))

    if not numbers:
        return "0"

    best = 1
    current = 1

    for index in range(1, len(numbers)):
        if numbers[index] == numbers[index - 1]:
            current += 1
        else:
            current = 1
        if current > best:
            best = current

    return str(best)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
```

---

## Problem 2: Smallest Missing Non-Negative

### Title
`Smallest Missing Non-Negative`

### Difficulty
`3`

### Description
You are given an array of integers. Find the smallest non-negative integer that does not appear in the array.

For example, if the array contains `0`, `1` and `3`, the answer is `2`.

### Input spec
The first line contains one integer `n`.

The second line contains `n` integers.

### Output spec
Print the smallest non-negative integer that is missing from the array.

### Constraints
- `1 <= n <= 200000`
- Values can be negative or positive.

### Examples

#### Example 1
Input:
```text
5
0 1 2 4 5
```

Output:
```text
3
```

#### Example 2
Input:
```text
4
1 2 3 4
```

Output:
```text
0
```

### Tests

#### Sample test
Input:
```text
6
0 2 1 4 2 0
```

Expected output:
```text
3
```

#### Hidden test
Input:
```text
5
-5 -1 -3 -2 -4
```

Expected output:
```text
0
```

#### Hidden test
Input:
```text
7
0 1 2 3 4 5 6
```

Expected output:
```text
7
```

#### Edge test
Input:
```text
8
2 2 2 0 1 1 3 5
```

Expected output:
```text
4
```

### Reference solution
```python
import sys


def solve(data: str) -> str:
    parts = data.strip().split()
    if not parts:
        return "0"

    n = int(parts[0])
    numbers = list(map(int, parts[1:1 + n]))
    seen = set(number for number in numbers if number >= 0)

    answer = 0
    while answer in seen:
        answer += 1

    return str(answer)


if __name__ == "__main__":
    print(solve(sys.stdin.read()))
```
