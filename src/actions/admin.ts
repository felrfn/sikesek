'use server';

import { prisma } from '@/lib/prisma';

export async function getDashboardMetrics() {
  const [
    totalBookings,
    homestays,
    venues,
    edutrips,
    violationsToday
  ] = await Promise.all([
    prisma.transaction.count(),
    prisma.homestay.findMany({ select: { isActive: true } }),
    prisma.venue.findMany({ select: { isActive: true } }),
    prisma.edutripPackage.findMany({ select: { isActive: true } }),
    
    // KTR Violations today
    prisma.smokingDetection.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })
  ]);

  const totalFacilities = homestays.length + venues.length + edutrips.length;
  const activeFacilities = 
    homestays.filter(h => h.isActive).length + 
    venues.filter(v => v.isActive).length + 
    edutrips.filter(e => e.isActive).length;

  return {
    totalBookings,
    totalFacilities,
    activeFacilities,
    violationsToday
  };
}

export async function getRecentAlerts() {
  const recentDetections = await prisma.smokingDetection.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    include: { area: true }
  });

  const recentTransactions = await prisma.transaction.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
    where: { paymentStatus: 'paid' }
  });

  return {
    recentDetections,
    recentTransactions
  };
}

export async function getAllFacilities() {
  const [homestays, venues, edutrips] = await Promise.all([
    prisma.homestay.findMany({ orderBy: { name: 'asc' } }),
    prisma.venue.findMany({ orderBy: { name: 'asc' } }),
    prisma.edutripPackage.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const allFacilities = [
    ...homestays.map(h => ({
      id: h.id,
      name: h.name,
      category: 'Homestay',
      capacity: `${h.maxExtraBeds + 2} Pax`, // Mock logic
      price: `Rp ${Number(h.weekdayPrice).toLocaleString()}/night`,
      isActive: h.isActive
    })),
    ...venues.map(v => ({
      id: v.id,
      name: v.name,
      category: 'Meeting Point',
      capacity: `${v.maxCapacity} Pax`,
      price: `Rp ${Number(v.pricePerHour).toLocaleString()}/hour`,
      isActive: v.isActive
    })),
    ...edutrips.map(e => ({
      id: e.id,
      name: e.name,
      category: 'Edutrip',
      capacity: '4 pax', // Mock
      price: `Rp ${Number(e.pricePerPax).toLocaleString()}/pax`,
      isActive: e.isActive
    }))
  ];

  return allFacilities;
}

export async function getAllBookings() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      homestayBookings: { include: { homestay: true } },
      edutripBookings: { include: { package: true } },
      venueBookings: { include: { venue: true } },
    }
  });

  const bookings = transactions.flatMap(t => {
    const list: any[] = [];
    t.homestayBookings.forEach(h => {
      list.push({
        id: h.id,
        bookingId: `#BKG-${new Date(t.createdAt).getFullYear()}-${t.invoiceNumber.slice(-4)}`,
        visitorName: t.customerName,
        visitorInitials: t.customerName.slice(0, 2).toUpperCase(),
        facility: h.homestay.name,
        date: new Date(h.checkInDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        time: '14:00 - 12:00',
        paymentStatus: t.paymentStatus,
        status: h.bookingStatus
      });
    });
    t.venueBookings.forEach(v => {
      list.push({
        id: v.id,
        bookingId: `#BKG-${new Date(t.createdAt).getFullYear()}-${t.invoiceNumber.slice(-4)}`,
        visitorName: t.customerName,
        visitorInitials: t.customerName.slice(0, 2).toUpperCase(),
        facility: v.venue.name,
        date: new Date(v.bookingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        time: `${new Date(v.startTime).getHours()}:00 - ${new Date(v.endTime).getHours()}:00`,
        paymentStatus: t.paymentStatus,
        status: v.bookingStatus
      });
    });
    t.edutripBookings.forEach(e => {
      list.push({
        id: e.id,
        bookingId: `#BKG-${new Date(t.createdAt).getFullYear()}-${t.invoiceNumber.slice(-4)}`,
        visitorName: t.customerName,
        visitorInitials: t.customerName.slice(0, 2).toUpperCase(),
        facility: e.package.name,
        date: new Date(e.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        time: 'Full Day',
        paymentStatus: t.paymentStatus,
        status: e.bookingStatus
      });
    });
    return list;
  });

  return {
    total: bookings.length,
    active: bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length,
    pending: bookings.filter(b => b.status === 'pending').length,
    list: bookings
  };
}

export async function getAllPayments() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const totalRevenue = transactions
    .filter(t => t.paymentStatus === 'paid')
    .reduce((sum, t) => sum + Number(t.totalAmount), 0);
  
  const refunded = transactions.filter(t => t.paymentStatus === 'refunded').length;
  
  const successRate = transactions.length > 0 
    ? ((transactions.filter(t => t.paymentStatus === 'paid').length / transactions.length) * 100).toFixed(1)
    : 0;

  return {
    revenue: totalRevenue,
    refunded,
    successRate,
    list: transactions.map(t => ({
      id: t.id,
      transactionId: `#TRX-${t.invoiceNumber.slice(-5)}`,
      date: new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      user: t.customerName,
      facility: 'SIKESEK Booking', // Aggregate name
      amount: `Rp ${Number(t.totalAmount).toLocaleString()}`,
      status: t.paymentStatus
    }))
  };
}

export async function getKtrMonitoring() {
  const [detections, areas] = await Promise.all([
    prisma.smokingDetection.findMany({
      orderBy: { createdAt: 'desc' },
      include: { area: true, assignedUser: true, resolvedUser: true }
    }),
    prisma.monitoredArea.findMany({ select: { id: true, isActive: true } })
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalViolationsToday = detections.filter(d => 
    d.status === 'open' && new Date(d.createdAt) >= today
  ).length;

  const loggedToday = detections.filter(d => new Date(d.createdAt) >= today).length;
  const totalResolved = detections.filter(d => d.status === 'resolved').length;
  
  const onlineCameras = areas.filter(a => a.isActive).length;
  const totalCameras = areas.length;

  return {
    totalViolationsToday,
    loggedToday,
    totalResolved,
    onlineCameras,
    totalCameras,
    list: detections.map(d => ({
      id: d.id,
      imageUrl: d.imageUrl,
      type: d.status === 'false_positive' ? 'False Positive' : 'Smoking',
      time: new Date(d.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      location: d.area?.name || 'Unknown Location',
      confidence: d.confidence ? Number(d.confidence) * 100 : 0,
      status: d.status
    }))
  };
}
