import tkinter as tk
import random

CELL_SIZE = 30
COLS, ROWS = 10, 20
DELAY = 400  # 낙하 주기 (ms)

SHAPES = {
    'I': [[(0, 1), (1, 1), (2, 1), (3, 1)], [(2, 0), (2, 1), (2, 2), (2, 3)]],
    'O': [[(1, 0), (2, 0), (1, 1), (2, 1)]],
    'T': [[(1, 0), (0, 1), (1, 1), (2, 1)], [(1, 0), (1, 1), (2, 1), (1, 2)],
          [(0, 1), (1, 1), (2, 1), (1, 2)], [(1, 0), (0, 1), (1, 1), (1, 2)]],
    'S': [[(1, 0), (2, 0), (0, 1), (1, 1)], [(1, 0), (1, 1), (2, 1), (2, 2)]],
    'Z': [[(0, 0), (1, 0), (1, 1), (2, 1)], [(2, 0), (1, 1), (2, 1), (1, 2)]],
    'J': [[(0, 0), (0, 1), (1, 1), (2, 1)], [(1, 0), (2, 0), (1, 1), (1, 2)],
          [(0, 1), (1, 1), (2, 1), (2, 2)], [(1, 0), (1, 1), (0, 2), (1, 2)]],
    'L': [[(2, 0), (0, 1), (1, 1), (2, 1)], [(1, 0), (1, 1), (1, 2), (2, 2)],
          [(0, 1), (1, 1), (2, 1), (0, 2)], [(0, 0), (1, 0), (1, 1), (1, 2)]],
}

COLORS = {
    'I': '#00f0f0', 'O': '#f0f000', 'T': '#a000f0',
    'S': '#00f000', 'Z': '#f00000', 'J': '#0000f0', 'L': '#f0a000'
}

class Tetris:
    def __init__(self, root):
        self.root = root
        self.root.title("Tetris")
        self.root.resizable(False, False)

        self.score_label = tk.Label(root, text="점수: 0", font=("Arial", 14, "bold"))
        self.score_label.pack(pady=5)

        self.canvas = tk.Canvas(root, width=COLS * CELL_SIZE, height=ROWS * CELL_SIZE, bg="#111")
        self.canvas.pack()

        self.root.bind("<Left>", lambda e: self.move(-1, 0))
        self.root.bind("<Right>", lambda e: self.move(1, 0))
        self.root.bind("<Down>", lambda e: self.drop())
        self.root.bind("<Up>", lambda e: self.rotate())
        self.root.bind("<space>", lambda e: self.hard_drop())
        self.root.bind("<r>", lambda e: self.start())

        self.start()

    def start(self):
        self.board = [[None] * COLS for _ in range(ROWS)]
        self.score = 0
        self.game_over = False
        self.update_score(0)
        self.spawn()
        self.tick()

    def spawn(self):
        self.shape_key = random.choice(list(SHAPES.keys()))
        self.rot_idx = 0
        self.shape = SHAPES[self.shape_key][self.rot_idx]
        self.x = COLS // 2 - 2
        self.y = 0

        if not self.valid(self.x, self.y, self.shape):
            self.game_over = True
            self.draw()

    def valid(self, px, py, shape):
        for dx, dy in shape:
            nx, ny = px + dx, py + dy
            if nx < 0 or nx >= COLS or ny >= ROWS:
                return False
            if ny >= 0 and self.board[ny][nx]:
                return False
        return True

    def move(self, dx, dy):
        if self.game_over:
            return
        if self.valid(self.x + dx, self.y + dy, self.shape):
            self.x += dx
            self.y += dy
            self.draw()

    def rotate(self):
        if self.game_over:
            return
        next_rot = (self.rot_idx + 1) % len(SHAPES[self.shape_key])
        cand_shape = SHAPES[self.shape_key][next_rot]
        if self.valid(self.x, self.y, cand_shape):
            self.rot_idx = next_rot
            self.shape = cand_shape
            self.draw()

    def drop(self):
        if self.game_over:
            return
        if self.valid(self.x, self.y + 1, self.shape):
            self.y += 1
        else:
            self.freeze()
        self.draw()

    def hard_drop(self):
        if self.game_over:
            return
        while self.valid(self.x, self.y + 1, self.shape):
            self.y += 1
        self.freeze()
        self.draw()

    def freeze(self):
        for dx, dy in self.shape:
            ny, nx = self.y + dy, self.x + dx
            if 0 <= ny < ROWS and 0 <= nx < COLS:
                self.board[ny][nx] = COLORS[self.shape_key]
        self.clear_lines()
        self.spawn()

    def clear_lines(self):
        new_board = [row for row in self.board if any(c is None for c in row)]
        cleared = ROWS - len(new_board)
        if cleared > 0:
            self.board = [[None] * COLS for _ in range(cleared)] + new_board
            self.update_score(cleared * 100)

    def update_score(self, pts):
        self.score += pts
        self.score_label.config(text=f"점수: {self.score}")

    def tick(self):
        if not self.game_over:
            self.drop()
            self.root.after(DELAY, self.tick)

    def draw(self):
        self.canvas.delete("all")

        # 고정된 블록 그리기
        for r in range(ROWS):
            for c in range(COLS):
                color = self.board[r][c]
                if color:
                    self.draw_cell(c, r, color)

        # 현재 블록 그리기
        if not self.game_over:
            for dx, dy in self.shape:
                self.draw_cell(self.x + dx, self.y + dy, COLORS[self.shape_key])
        else:
            self.canvas.create_text(
                COLS * CELL_SIZE // 2, ROWS * CELL_SIZE // 2,
                text="GAME OVER\n'R'키로 재시작", fill="white",
                font=("Arial", 16, "bold"), justify="center"
            )

    def draw_cell(self, col, row, color):
        x1, y1 = col * CELL_SIZE, row * CELL_SIZE
        x2, y2 = x1 + CELL_SIZE, y1 + CELL_SIZE
        self.canvas.create_rectangle(x1, y1, x2, y2, fill=color, outline="#222", width=1)

if __name__ == "__main__":
    root = tk.Tk()
    Tetris(root)
    root.mainloop()
