
def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    pairs = {'{': '}', '(': ')', '[': ']'}
    
    # Very crude: ignore comments and strings
    import re
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'\"[^\"\n]*\"', '""', content)
    content = re.sub(r'\'[^\'\n]*\'', "''", content)
    content = re.sub(r'`.*?`', '``', content, flags=re.DOTALL)

    for i, char in enumerate(content):
        if char in '{ ( [':
            # Simplified for multi-char match
            pass
    
    # Let's just use a simple loop
    for i, char in enumerate(content):
        if char in '{([':
            stack.append((char, i))
        elif char in '})]':
            if not stack:
                print(f"Extra closing {char} at pos {i}")
                continue
            last_char, last_pos = stack.pop()
            if pairs[last_char] != char:
                print(f"Mismatched {char} at pos {i}, expected {pairs[last_char]} to match {last_char} at pos {last_pos}")

    if stack:
        for char, pos in stack:
            print(f"Unclosed {char} at pos {pos}")
            # Find line number
            line_no = content[:pos].count('\n') + 1
            print(f"Line {line_no}")
    else:
        print("Brackets balanced!")

if __name__ == '__main__':
    check_balance('frontend/src/pages/HeadToHead.jsx')
