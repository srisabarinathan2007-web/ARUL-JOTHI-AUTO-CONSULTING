import { ExternalLink, Globe, FileText, ShieldAlert, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';

const links = [
  {
    title: "POLICE FINE WEBSITE",
    url: "https://echallan.parivahan.gov.in/index/accused-challan",
    description: "Check and pay traffic e-challans",
    icon: ShieldAlert,
    color: "bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-500 hover:text-white"
  },
  {
    title: "SARATHI WEBSITE",
    url: "https://sarathi.parivahan.gov.in/sarathiservice/stateSelectBean.do",
    description: "Driving license services and applications",
    icon: FileText,
    color: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white"
  },
  {
    title: "NATIONAL PERMIT WEBSITE",
    url: "https://sarathi.parivahan.gov.in/sarathiservice/stateSelectBean.do",
    description: "Apply and renew national permits for commercial vehicles",
    icon: CreditCard,
    color: "bg-modern-blue/5 text-modern-blue border-modern-blue/10 hover:bg-modern-blue hover:text-white"
  },
  {
    title: "VAHAN PORTAL",
    url: "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/statevalidation/homepage.xhtml",
    description: "Vehicle related services, tax payment and registration",
    icon: Globe,
    color: "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-600 hover:text-white"
  }
];

export default function WebsiteLinks() {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1.5 h-8 bg-modern-blue rounded-full shadow-lg shadow-modern-blue/20" />
        <h2 className="text-2xl font-display font-bold text-modern-text tracking-tight uppercase">Website Links</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {links.map((link, index) => (
          <motion.a
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group modern-card p-6 rounded-[2rem] hover:border-modern-blue transition-all duration-500 flex flex-col h-full"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 border ${link.color}`}>
              <link.icon className="w-7 h-7" />
            </div>
            
            <h3 className="text-sm font-black text-modern-text uppercase tracking-widest mb-2 transition-all">
              {link.title}
            </h3>
            
            <p className="text-modern-muted text-xs font-bold leading-relaxed mb-6 flex-1">
              {link.description}
            </p>
            
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-modern-blue group-hover:translate-x-1 transition-transform">
              Visit Portal <ExternalLink className="w-3 h-3" />
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
