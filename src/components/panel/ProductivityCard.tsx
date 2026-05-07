interface ProductivityCardProps {
  executedQty: number
  teamSize:    number
  workedHours: number
  unit?:       string
}

export default function ProductivityCard({ executedQty, teamSize, workedHours, unit = 'm' }: ProductivityCardProps) {
  const denominator  = teamSize * workedHours
  const productivity = denominator > 0 ? executedQty / denominator : 0

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Índice de Produtividade</p>
      <p className="text-2xl font-bold text-blue-700 mt-0.5">
        {productivity.toFixed(3)}
        <span className="text-sm font-normal ml-1 text-blue-500">{unit}/Hh</span>
      </p>
      <p className="text-xs text-blue-500 mt-1">
        {executedQty} {unit} ÷ ({teamSize} pessoas × {workedHours} h)
      </p>
    </div>
  )
}
