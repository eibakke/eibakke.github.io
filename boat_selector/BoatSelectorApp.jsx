import React, { useState, useEffect } from 'react';
import { Calculator, Users, Heart, X, ExternalLink, Plus, Minus } from 'lucide-react';

const BoatSelectorApp = () => {
  const [currentPage, setCurrentPage] = useState('budget');
  const [familySize, setFamilySize] = useState(4);
  const [annualBudget, setAnnualBudget] = useState(50000);
  const [boatType, setBoatType] = useState('motorboat');
  const [savedBoats, setSavedBoats] = useState([]);
  const [showAddBoat, setShowAddBoat] = useState(false);
  
  // Financing states
  const [boatPrice, setBoatPrice] = useState(750000);
  const [interestRate, setInterestRate] = useState(4.5);
  const [loanYears, setLoanYears] = useState(5);
  const [upfrontContributions, setUpfrontContributions] = useState([
    { personId: 1, amount: 0, name: 'Person 1' },
    { personId: 2, amount: 0, name: 'Person 2' },
    { personId: 3, amount: 0, name: 'Person 3' },
    { personId: 4, amount: 0, name: 'Person 4' }
  ]);

  // Update upfront contributions when family size changes
  useEffect(() => {
    const updateContributions = () => {
      setUpfrontContributions(prev => {
        const current = [...prev];
        if (current.length < familySize) {
          for (let i = current.length; i < familySize; i++) {
            current.push({ personId: i + 1, amount: 0, name: `Person ${i + 1}` });
          }
        } else if (current.length > familySize) {
          current.splice(familySize);
        }
        return current;
      });
    };
    updateContributions();
  }, [familySize]);

  // Financing calculations
  const getFinancingCalculation = () => {
    const totalUpfront = upfrontContributions.reduce((sum, p) => sum + p.amount, 0);
    
    // Calculate each person's details
    const breakdown = upfrontContributions.map(person => {
      const equalShare = boatPrice / familySize;
      const excessUpfront = person.amount - equalShare;
      const ownershipShare = 1 / familySize; // Everyone owns equal shares
      
      return {
        ...person,
        equalShare,
        excessUpfront,
        ownershipShare
      };
    });

    // Calculate who owes money to whom
    const lenders = breakdown.filter(p => p.excessUpfront > 0);
    const borrowers = breakdown.filter(p => p.excessUpfront < 0);
    
    if (lenders.length > 0 && borrowers.length > 0) {
      // There are internal loans needed
      const totalLentAmount = lenders.reduce((sum, p) => sum + p.excessUpfront, 0);
      const totalBorrowedAmount = borrowers.reduce((sum, p) => sum + Math.abs(p.excessUpfront), 0);
      const actualLoanAmount = Math.min(totalLentAmount, totalBorrowedAmount);
      
      // Calculate monthly payment for the internal loan
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = loanYears * 12;
      const monthlyPaymentForLoan = monthlyRate > 0 
        ? actualLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
        : actualLoanAmount / numPayments;
      const totalInterest = (monthlyPaymentForLoan * numPayments) - actualLoanAmount;

      const finalBreakdown = breakdown.map(person => {
        let netMonthlyPayment = 0;
        let monthlyCredit = 0;
        let monthsToBreakEven = numPayments;

        if (person.excessUpfront > 0) {
          // This person lent money and receives monthly payments
          const lenderShare = person.excessUpfront / totalLentAmount;
          monthlyCredit = lenderShare * monthlyPaymentForLoan;
          netMonthlyPayment = -monthlyCredit; // Negative means they receive money
        } else if (person.excessUpfront < 0) {
          // This person borrowed money and makes monthly payments
          const borrowerShare = Math.abs(person.excessUpfront) / totalBorrowedAmount;
          netMonthlyPayment = borrowerShare * monthlyPaymentForLoan;
          monthlyCredit = 0;
        } else {
          // This person paid exactly their share
          netMonthlyPayment = 0;
          monthlyCredit = 0;
          monthsToBreakEven = 0;
        }

        return {
          ...person,
          monthlyPayment: 0,
          monthlyCredit,
          netMonthlyPayment,
          monthsToBreakEven
        };
      });

      return {
        totalUpfront,
        monthlyPayment: monthlyPaymentForLoan,
        totalInterest,
        internalLoanAmount: actualLoanAmount,
        breakdown: finalBreakdown
      };
    } else {
      // Everyone paid exactly their share or there's some other balance
      const finalBreakdown = breakdown.map(person => ({
        ...person,
        monthlyPayment: 0,
        monthlyCredit: 0,
        netMonthlyPayment: 0,
        monthsToBreakEven: 0
      }));

      return {
        totalUpfront,
        monthlyPayment: 0,
        totalInterest: 0,
        internalLoanAmount: 0,
        breakdown: finalBreakdown
      };
    }
  };

  // Cost percentages by boat type
  const costPercentages = {
    motorboat: { min: 0.06, max: 0.08, avg: 0.07 },
    sailboat: { min: 0.05, max: 0.07, avg: 0.06 },
    speedboat: { min: 0.07, max: 0.09, avg: 0.08 },
    fishing: { min: 0.04, max: 0.06, avg: 0.05 }
  };

  // Calculate max affordable boat price
  const getMaxPrice = () => {
    return Math.floor(annualBudget / costPercentages[boatType].avg);
  };

  // Generate Finn.no search URL
  const getFinnSearchUrl = (minPrice = 0, maxPrice = null) => {
    const price = maxPrice || getMaxPrice();
    return `https://www.finn.no/mobility/search/boat?no_of_seats_from=8&price_from=${minPrice}&price_to=${price}&sales_form=120&sales_form=121`;
  };

  // Vote on boats
  const voteBoat = (boatId, vote) => {
    setSavedBoats(prev => prev.map(boat => 
      boat.id === boatId 
        ? { ...boat, votes: { ...boat.votes, [vote]: (boat.votes[vote] || 0) + 1 } }
        : boat
    ));
  };

  // Add new boat
  const addBoat = (boatData) => {
    const newBoat = {
      id: Date.now(),
      ...boatData,
      votes: { up: 0, down: 0 },
      addedBy: 'Family Member',
      dateAdded: new Date().toLocaleDateString('no-NO')
    };
    setSavedBoats(prev => [...prev, newBoat]);
    setShowAddBoat(false);
  };

  // Remove boat
  const removeBoat = (boatId) => {
    setSavedBoats(prev => prev.filter(boat => boat.id !== boatId));
  };

  const BudgetCalculator = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Båt Budsjett Kalkulator
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Antall personer som deler:</label>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setFamilySize(Math.max(1, familySize - 1))}
                className="p-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xl font-bold w-12 text-center">{familySize}</span>
              <button 
                onClick={() => setFamilySize(familySize + 1)}
                className="p-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Årlig budsjett totalt (NOK):</label>
            <input
              type="range"
              min="10000"
              max="150000"
              step="5000"
              value={annualBudget}
              onChange={(e) => setAnnualBudget(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center font-bold text-lg">
              {annualBudget.toLocaleString('no-NO')} kr
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium mb-2">Type båt:</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries({
              motorboat: 'Motorbåt/Kabinebåt',
              sailboat: 'Seilbåt', 
              speedboat: 'Speedbåt/Bowrider',
              fishing: 'Fiskebåt/Aluminiumsbåt'
            }).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setBoatType(key)}
                className={`p-3 rounded text-sm ${
                  boatType === key 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Resultat:</h3>
        <div className="grid md:grid-cols-3 gap-4 text-center">
          <div className="bg-white p-4 rounded">
            <div className="text-2xl font-bold text-green-600">
              {getMaxPrice().toLocaleString('no-NO')} kr
            </div>
            <div className="text-sm text-gray-600">Maks kjøpspris</div>
          </div>
          <div className="bg-white p-4 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {(annualBudget / familySize).toLocaleString('no-NO')} kr
            </div>
            <div className="text-sm text-gray-600">Årlig kostnad per person</div>
          </div>
          <div className="bg-white p-4 rounded">
            <div className="text-2xl font-bold text-purple-600">
              {Math.floor(annualBudget / familySize / 12).toLocaleString('no-NO')} kr
            </div>
            <div className="text-sm text-gray-600">Måndelig kostnad per person</div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href={getFinnSearchUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700"
          >
            <ExternalLink className="w-4 h-4" />
            Søk på Finn.no (opp til {getMaxPrice().toLocaleString('no-NO')} kr)
          </a>
        </div>
      </div>
    </div>
  );

  const FinancingCalculator = () => {
    const financing = getFinancingCalculation();

    const updateContribution = (personId, amount) => {
      setUpfrontContributions(prev => 
        prev.map(p => p.personId === personId ? { ...p, amount: Number(amount) || 0 } : p)
      );
    };

    const updatePersonName = (personId, name) => {
      setUpfrontContributions(prev => 
        prev.map(p => p.personId === personId ? { ...p, name } : p)
      );
    };

    return (
      <div className="space-y-6">
        <div className="bg-purple-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Intern Finansiering med Forskudd
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Båtpris (NOK):</label>
              <input
                type="number"
                value={boatPrice}
                onChange={(e) => setBoatPrice(Number(e.target.value) || 0)}
                className="w-full p-2 border border-gray-300 rounded"
                step="10000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Rente (%):</label>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
                className="w-full p-2 border border-gray-300 rounded"
                step="0.1"
                min="0"
                max="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Låneperiode (år):</label>
              <input
                type="number"
                value={loanYears}
                onChange={(e) => setLoanYears(Number(e.target.value) || 1)}
                className="w-full p-2 border border-gray-300 rounded"
                min="1"
                max="15"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Forskudd per person:</h3>
            <div className="grid gap-3">
              {upfrontContributions.map(person => (
                <div key={person.personId} className="flex gap-3 items-center bg-white p-3 rounded">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={person.name}
                      onChange={(e) => updatePersonName(person.personId, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder="Navn"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={person.amount || ''}
                      onChange={(e) => updateContribution(person.personId, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                      placeholder="Forskudd (NOK)"
                      step="5000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Finansieringssammendrag:</h3>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">
                {financing.totalUpfront.toLocaleString('no-NO')} kr
              </div>
              <div className="text-sm text-gray-600">Totalt forskudd</div>
            </div>
            <div className="bg-white p-4 rounded text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(financing.monthlyPayment || 0).toLocaleString('no-NO')} kr
              </div>
              <div className="text-sm text-gray-600">Måndelig betaling (internt)</div>
            </div>
            <div className="bg-white p-4 rounded text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(financing.totalInterest || 0).toLocaleString('no-NO')} kr
              </div>
              <div className="text-sm text-gray-600">Total rente</div>
            </div>
          </div>

          <h4 className="text-md font-semibold mb-3">Månedlig fordeling per person:</h4>
          <div className="space-y-3">
            {financing.breakdown.map(person => (
              <div key={person.personId} className="bg-white p-4 rounded border">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{person.name}</span>
                  <span className="text-sm text-gray-500">
                    {(person.ownershipShare * 100).toFixed(1)}% eierandel
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Forskudd:</span>
                    <div className="font-semibold">
                      {person.amount.toLocaleString('no-NO')} kr
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Lik andel:</span>
                    <div className="font-semibold">
                      {Math.round(person.equalShare).toLocaleString('no-NO')} kr
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Ekstra forskudd:</span>
                    <div className={`font-semibold ${person.excessUpfront > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.round(person.excessUpfront).toLocaleString('no-NO')} kr
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Månedlig kreditt:</span>
                    <div className="font-semibold text-green-600">
                      {person.monthlyCredit !== 0 ? (person.monthlyCredit > 0 ? '+' : '') : ''}{Math.round(person.monthlyCredit || 0).toLocaleString('no-NO')} kr
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Netto månedlig:</span>
                    <div className={`font-bold text-lg ${person.netMonthlyPayment < 0 ? 'text-green-600' : person.netMonthlyPayment > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {person.netMonthlyPayment !== 0 ? (person.netMonthlyPayment < 0 ? '+' : '') : ''}{Math.abs(Math.round(person.netMonthlyPayment || 0)).toLocaleString('no-NO')} kr
                      {person.netMonthlyPayment < 0 ? ' (mottar)' : person.netMonthlyPayment > 0 ? ' (betaler)' : ' (utlignet)'}
                    </div>
                  </div>
                </div>
                {person.monthsToBreakEven > 0 && (
                  <div className="mt-2 text-sm text-blue-600">
                    ⏱️ Utlignet etter {person.monthsToBreakEven} måneder
                    ({(person.monthsToBreakEven / 12).toFixed(1)} år)
                  </div>
                )}
              </div>
            ))}
          </div>

          {financing.internalLoanAmount > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 rounded border-l-4 border-yellow-400">
              <h4 className="font-semibold text-yellow-800 mb-2">💡 Forklaring:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Alle eier like store andeler av båten ({(100/familySize).toFixed(1)}% hver)</li>
                <li>• De som betalte mindre enn sin andel betaler månedlig til de som betalte mer</li>
                <li>• De som betalte mer mottar månedlige betalinger med rente</li>
                <li>• Etter {loanYears} år er alle utlignet</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AddBoatForm = ({ onAdd, onCancel }) => {
    const [formData, setFormData] = useState({
      name: '',
      price: '',
      year: '',
      length: '',
      engine: '',
      finnUrl: '',
      description: ''
    });

    const handleSubmit = () => {
      if (formData.name && formData.price) {
        onAdd({
          ...formData,
          price: Number(formData.price)
        });
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">Legg til båt</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Navn/Modell:</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Pris (NOK):</label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({...prev, price: e.target.value}))}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Årsmodell:</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData(prev => ({...prev, year: e.target.value}))}
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lengde:</label>
                <input
                  type="text"
                  value={formData.length}
                  onChange={(e) => setFormData(prev => ({...prev, length: e.target.value}))}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="f.eks. 7,5m"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Motor:</label>
                <input
                  type="text"
                  value={formData.engine}
                  onChange={(e) => setFormData(prev => ({...prev, engine: e.target.value}))}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="f.eks. 200 HK"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Finn.no lenke:</label>
              <input
                type="url"
                value={formData.finnUrl}
                onChange={(e) => setFormData(prev => ({...prev, finnUrl: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Beskrivelse:</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                className="w-full p-2 border border-gray-300 rounded h-20"
                placeholder="Hvorfor tror du denne båten passer for familien?"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Legg til båt
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const BoatList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Foreslåtte Båter ({savedBoats.length})
        </h2>
        <button
          onClick={() => setShowAddBoat(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Legg til båt
        </button>
      </div>

      {savedBoats.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Ingen båter er lagt til ennå.</p>
          <p>Bruk budsjettkalkulatoren for å finne båter på Finn.no, eller legg til en båt manuelt.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedBoats
            .sort((a, b) => (b.votes.up - b.votes.down) - (a.votes.up - a.votes.down))
            .map(boat => (
            <div key={boat.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{boat.name}</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {boat.price.toLocaleString('no-NO')} kr
                  </p>
                  <p className="text-sm text-gray-600">
                    Kostnad per person: {Math.floor(boat.price / familySize).toLocaleString('no-NO')} kr
                  </p>
                </div>
                <button
                  onClick={() => removeBoat(boat.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {boat.year && (
                  <div className="text-sm">
                    <span className="font-medium">Årsmodell:</span> {boat.year}
                  </div>
                )}
                {boat.length && (
                  <div className="text-sm">
                    <span className="font-medium">Lengde:</span> {boat.length}
                  </div>
                )}
                {boat.engine && (
                  <div className="text-sm">
                    <span className="font-medium">Motor:</span> {boat.engine}
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium">Lagt til:</span> {boat.dateAdded}
                </div>
              </div>

              {boat.description && (
                <p className="text-sm text-gray-700 mb-4">{boat.description}</p>
              )}

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => voteBoat(boat.id, 'up')}
                    className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    <Heart className="w-4 h-4" />
                    {boat.votes.up}
                  </button>
                  <button
                    onClick={() => voteBoat(boat.id, 'down')}
                    className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                    {boat.votes.down}
                  </button>
                  <span className="text-sm text-gray-500">
                    Score: {boat.votes.up - boat.votes.down}
                  </span>
                </div>
                {boat.finnUrl && (
                  <a
                    href={boat.finnUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Se på Finn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddBoat && (
        <AddBoatForm
          onAdd={addBoat}
          onCancel={() => setShowAddBoat(false)}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Familie Båt Velger</h1>
          <p className="text-gray-600">Koordiner båtkjøp med familie og venner</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex mb-6 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setCurrentPage('budget')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
              currentPage === 'budget'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Budsjett Kalkulator
          </button>
          <button
            onClick={() => setCurrentPage('financing')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
              currentPage === 'financing'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Intern Finansiering
          </button>
          <button
            onClick={() => setCurrentPage('boats')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
              currentPage === 'boats'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Foreslåtte Båter
          </button>
        </div>

        {currentPage === 'budget' ? <BudgetCalculator /> : 
         currentPage === 'financing' ? <FinancingCalculator /> : 
         <BoatList />}
      </div>
    </div>
  );
};

export default BoatSelectorApp;

