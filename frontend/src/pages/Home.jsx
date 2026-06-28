import React from 'react'
import Hero from '../components/Hero'
import LatestCollection from '../components/LatestCollection'
import BestSeller from '../components/BestSeller'
import OurPolicy from '../components/OurPolicy'
import NewsletterBox from '../components/NewsletterBox'
import NearbyDeals from '../components/NearbyDeals'

const Home = () => {
  return (
    <div>
      <Hero />
      <LatestCollection />
      <BestSeller />
      {/* Open Box Deals — returned products listed for resale near user */}
      <NearbyDeals />
      <OurPolicy />
      <NewsletterBox />
    </div>
  )
}

export default Home
