class Event:
	"""
	This class represents a talk and valuable info for each talk
	"""
	def __init__(self,name,duration):
		self.name=name
		self.duration=duration
		self.scheduled=False

	def __repr__(self):
		return self.name