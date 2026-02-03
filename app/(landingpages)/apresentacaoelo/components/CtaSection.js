export default function CtaSection() {
  return (
    <section className="snap-start h-screen flex flex-col items-center justify-center px-6 bg-white relative text-black">
      <div className="max-w-4xl mx-auto text-center z-10">
        <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tighter">
          O futuro da obra<br/>começa agora.
        </h2>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
          Acesse o BIM Manager e experimente o primeiro passo do ecossistema <strong>Elo 57</strong>.
        </p>
        
        <button className="group bg-black text-white px-12 py-5 rounded-full font-bold text-xl hover:bg-[#FF6700] hover:text-black transition-all duration-300 flex items-center mx-auto gap-4 shadow-xl hover:shadow-[#FF6700]/30">
          Acessar Sistema
          <svg className="w-6 h-6 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
        </button>
      </div>

      {/* Footer Minimalista */}
      <div className="absolute bottom-10 text-center w-full">
        <p className="text-gray-400 text-xs">© 2024 Grupo Studio 57.</p>
      </div>
    </section>
  );
}