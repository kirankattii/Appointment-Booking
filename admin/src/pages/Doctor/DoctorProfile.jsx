import React, { useContext, useEffect, useState } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { toast } from 'react-toastify'
import axios from 'axios'

const DoctorProfile = () => {
  const { dToken, getProfileData, profileData, setProfileData, backendUrl } = useContext(DoctorContext)

  const [isEdit, setIsEdit] = useState(false)

  const updateProfile = async () => {
    try {
      const updateData = {
        address: profileData.address,
        fees: profileData.fees,
        available: profileData.available
      }

      const { data } = await axios.post(backendUrl + '/api/doctor/update-profile', updateData, { headers: { dToken } })
      if (data.success) {
        toast.success(data.message)
        setIsEdit(false)
        getProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error);
      toast.error(error.message)

    }
  }




  useEffect(() => {
    if (dToken) {
      getProfileData()

    }
  }, [dToken])

  return profileData && (
    <div>
      <div className='flex flex-col gap-4 m-5'>

        <div>
          <img className='bg-primary/80 w-full sm:max-w-64  rounded-lg' src={profileData.image} alt="" />
        </div>

        <div className='flex-1 border border-stone-100 rounded-lg  p-8 py-7 bg-white'>
          <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>{profileData.name}</p>
          <div className='flex items-center gap-2 text-gray-600'>
            <p>{profileData.degree} - {profileData.speciality}</p>
            <button className='ppy0.5
             px-2 rounded-full text-xs border'>{profileData.experience}</button>
          </div>

          <div>
            <p className='flex items-center gap-1 text-sm font-medium text-neutral-800 mt-3'>About:</p>
            <p className='text-sm text-gray-600 max-w-[700px] mt-1'>{profileData.about}</p>
          </div>

          <p className='text-gray-600 font-medium mt-4'>
            Appointment Fee: <span className='text-gray-800'>$ {isEdit ? <input type="number" onChange={(e) => setProfileData(prev => ({ ...prev, fees: e.target.value }))} value={profileData.fees} /> : profileData.fees}</span>
          </p>

          <div className='flex gap-2 py-2'>
            <p>Address:</p>
            <p className='text-sm'>
              {isEdit ? <input type="text" onChange={(e) => setProfileData(prev => ({ ...prev, address: { ...prev.address, line1: e.target.value } }))} value={profileData.address.line1} /> : profileData.address.line1}
              <br />
              {isEdit ? <input type="text" onChange={(e) => setProfileData(prev => ({ ...prev, address: { ...prev.address, line2: e.target.value } }))} value={profileData.address.line2} /> : profileData.address.line2}
            </p>
          </div>

          <div className='flex items-center gap-1 pt-2'>
            <input onChange={() => isEdit && setProfileData(prev => ({ ...prev, available: !prev.available }))} checked={profileData.available} type="checkbox" />
            <label htmlFor="">Available</label>
          </div>

          {isEdit ?
            <button className=' px-4 py-1 border border-primary text-sm  hover:bg-primary hover:text-white rounded-full mt-5 transition-all' onClick={updateProfile}>Save</button>
            :
            <button className=' px-4 py-1 border border-primary text-sm  hover:bg-primary hover:text-white rounded-full mt-5 transition-all' onClick={() => setIsEdit(true)}>Edit</button>
          }



        </div>

      </div>
    </div>
  )
}

export default DoctorProfile