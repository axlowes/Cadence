export function Placeholder({ title, line }: { title: string; line: string }) {
  return (
    <div className="screen">
      <header className="glass card">
        <h1 className="serif">{title}</h1>
        <p>{line}</p>
      </header>
    </div>
  )
}
