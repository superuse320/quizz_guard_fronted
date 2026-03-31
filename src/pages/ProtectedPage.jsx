export default function ProtectedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
      <div className="max-w-3xl w-full p-8 bg-gray-800/60 border border-white/5 rounded-xl">
        <h1 className="text-2xl font-bold">Área protegida</h1>
        <p className="mt-2 text-gray-300">Solo usuarios autenticados pueden ver esta ruta.</p>
      </div>
    </div>
  )
}
