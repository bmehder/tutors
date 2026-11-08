import { useState } from 'react';
import { ArrowRight, CheckCircle2, GraduationCap, MessageCircle } from 'lucide-react';

export default function ContactSection() {
  const [kind, setKind] = useState('family');
  const [submitted, setSubmitted] = useState(false);
  const isTutor = kind === 'tutor';

  return (
    <section id="contact" className="border-t border-ink/10 bg-white py-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-[.8fr_1.2fr] gap-10 lg:gap-20">
        <div>
          <p className="eyebrow text-ink/55 mb-3">There’s a place for you here</p>
          <h2 className="text-4xl font-semibold">Let’s start a <span className="serif">conversation.</span></h2>
          <p className="text-sm leading-7 text-ink/65 mt-5 max-w-sm">Finding the right support is personal. Ask us about your student’s needs, or tell us how you’d love to help students grow.</p>
          <div className="mt-8 space-y-6">
            <div className="flex gap-4"><MessageCircle size={23} className="shrink-0 mt-1"/><div><h3 className="font-semibold">For families</h3><p className="text-sm leading-6 text-ink/65 mt-1">Questions about subjects, scheduling, packages, or finding the right tutor? Start here.</p></div></div>
            <div className="flex gap-4"><GraduationCap size={25} className="shrink-0 mt-1"/><div><h3 className="font-semibold">For potential tutors</h3><p className="text-sm leading-6 text-ink/65 mt-1">Bring your subject knowledge and a Biblical worldview. Share your experience and the times you could teach.</p></div></div>
          </div>
          <p className="text-xs leading-5 text-ink/55 mt-8 border-t border-ink/10 pt-5">This is a mock form. Use sample information. Nothing entered here is sent or saved.</p>
        </div>
        <div className="border border-ink/15 bg-cream rounded-xl p-6 md:p-8">
          <fieldset className="mb-7">
            <legend className="text-xs font-semibold mb-3">How can we help?</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              {[['family', 'I have a question'], ['tutor', 'I’d like to tutor']].map(([value, label]) => (
                <label key={value} className={`flex items-center gap-3 cursor-pointer rounded-lg border p-4 text-sm font-semibold ${kind === value ? 'border-ink bg-[#eaf0e9]' : 'border-ink/20 bg-white'}`}>
                  <input type="radio" name="contact-type" value={value} checked={kind === value} onChange={() => { setKind(value); setSubmitted(false); }} className="accent-[#143f3c]"/>{label}
                </label>
              ))}
            </div>
          </fieldset>
          {submitted ? (
            <div role="status" className="py-5">
              <CheckCircle2 size={36} className="text-[#517253] mb-4"/>
              <h3 className="text-2xl font-semibold">{isTutor ? 'A thoughtful first step.' : 'Thanks for reaching out.'}</h3>
              <p className="text-sm leading-7 text-ink/70 mt-3">{isTutor ? 'This is how a tutor application confirmation would appear.' : 'This is how a family inquiry confirmation would appear.'} This was a demo only. Your information was not sent or saved, and no one will contact you.</p>
              <button type="button" className="btn mt-6" onClick={() => setSubmitted(false)}>Try the form again <ArrowRight size={16}/></button>
            </div>
          ) : (
            <form key={kind} onSubmit={event => { event.preventDefault(); event.currentTarget.reset(); setSubmitted(true); }} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold">Your name <span className="font-normal">(required)</span><input required name="name" autoComplete="name" className="field mt-2" placeholder="Alex Taylor" maxLength={120}/></label>
                <label className="block text-xs font-semibold">Email address <span className="font-normal">(required)</span><input required type="email" name="email" autoComplete="email" className="field mt-2" placeholder="alex@example.com" maxLength={254}/></label>
              </div>
              {isTutor ? <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-xs font-semibold">Subjects you could teach (required)<input required name="subjects" className="field mt-2" placeholder="e.g. Algebra, Biology" maxLength={300}/></label>
                  <label className="block text-xs font-semibold">Grade levels (required)<input required name="grades" className="field mt-2" placeholder="e.g. Grades 6–12" maxLength={120}/></label>
                </div>
                <label className="block text-xs font-semibold">Teaching experience & qualifications (required)<textarea required name="experience" rows={3} className="field mt-2 resize-y" placeholder="Tell us about your teaching background and relevant qualifications." maxLength={3000}/></label>
                <label className="block text-xs font-semibold">Days, times & time zone (required)<textarea required name="availability" rows={2} className="field mt-2 resize-y" placeholder="e.g. Mondays and Wednesdays, 3–6 PM Eastern" maxLength={1000}/></label>
                <label className="block text-xs font-semibold">Your approach to a Biblical worldview (required)<textarea required name="approach" rows={3} className="field mt-2 resize-y" placeholder="How would your faith shape the way you teach and encourage students?" maxLength={3000}/></label>
              </> : <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-xs font-semibold">What’s your question about?<select name="topic" className="field mt-2"><option>Finding the right tutor</option><option>Subjects & grade levels</option><option>Packages & pricing</option><option>Scheduling & availability</option><option>Something else</option></select></label>
                  <label className="block text-xs font-semibold">Student’s grade (optional)<select name="grade" className="field mt-2"><option value="">Select a grade</option>{Array.from({length:9},(_,i)=><option key={i}>Grade {i+4}</option>)}<option>Other / not sure</option></select></label>
                </div>
                <label className="block text-xs font-semibold">Your question (required)<textarea required name="message" rows={5} className="field mt-2 resize-y" placeholder="Tell us a little about what your family needs." maxLength={3000}/></label>
              </>}
              <p className="text-xs text-ink/60">Demo only · Nothing will be submitted or saved.</p>
              <button type="submit" className="btn w-full sm:w-auto">{isTutor ? 'Preview application confirmation' : 'Preview inquiry confirmation'}<ArrowRight size={16}/></button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
